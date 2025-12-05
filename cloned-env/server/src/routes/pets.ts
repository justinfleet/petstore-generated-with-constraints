import { Router, Request, Response } from 'express';
import db from '../lib/db.js';
import jwt from 'jsonwebtoken';

const router = Router();

// Auth middleware
const authenticate = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based authorization
const requireRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: Function) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Helper to get pet with category and tags
const getPetWithDetails = (petId: number) => {
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
  if (!pet) return null;

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(pet.category_id);
  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN pet_tags pt ON t.id = pt.tag_id
    WHERE pt.pet_id = ?
  `).all(petId);

  const photoUrls = db.prepare('SELECT photo_url FROM pet_photos WHERE pet_id = ?')
    .all(petId)
    .map((p: any) => p.photo_url);

  return {
    id: pet.id,
    name: pet.name,
    category: category || null,
    photoUrls,
    tags,
    status: pet.status
  };
};

// GET /api/v3/pet/findByStatus - All authenticated users per business requirements
router.get('/findByStatus', authenticate, requireRoles(['customer', 'store_owner', 'admin']), (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    if (!status) {
      return res.status(400).json({ error: 'Status parameter is required' });
    }

    const pets = db.prepare('SELECT id FROM pets WHERE status = ?').all(status);
    const result = pets.map((p: any) => getPetWithDetails(p.id)).filter(Boolean);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v3/pet/findByTags - All authenticated users per business requirements
router.get('/findByTags', authenticate, requireRoles(['customer', 'store_owner', 'admin']), (req: Request, res: Response) => {
  try {
    const tags = req.query.tags as string;
    if (!tags) {
      return res.status(400).json({ error: 'Tags parameter is required' });
    }

    const tagNames = tags.split(',').map(t => t.trim());
    const placeholders = tagNames.map(() => '?').join(',');
    
    const petIds = db.prepare(`
      SELECT DISTINCT p.id FROM pets p
      JOIN pet_tags pt ON p.id = pt.pet_id
      JOIN tags t ON pt.tag_id = t.id
      WHERE t.name IN (${placeholders})
    `).all(...tagNames);
    
    const result = petIds.map((p: any) => getPetWithDetails(p.id)).filter(Boolean);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v3/pet/:petId - All authenticated users per business requirements
router.get('/:petId', authenticate, requireRoles(['customer', 'store_owner', 'admin']), (req: Request, res: Response) => {
  try {
    const petId = parseInt(req.params.petId);
    const pet = getPetWithDetails(petId);
    
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    res.json(pet);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v3/pet - Store owner and admin only
router.post('/', authenticate, requireRoles(['store_owner', 'admin']), (req: Request, res: Response) => {
  try {
    const { name, category, photoUrls = [], tags = [], status = 'available' } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Pet name is required' });
    }

    // Get or create category
    let categoryId = null;
    if (category) {
      let cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(category.name);
      if (!cat) {
        const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(category.name);
        categoryId = result.lastInsertRowid as number;
      } else {
        categoryId = cat.id;
      }
    }

    // Insert pet
    const result = db.prepare(`
      INSERT INTO pets (name, category_id, status, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(name, categoryId, status);
    
    const petId = result.lastInsertRowid as number;

    // Add photo URLs
    if (photoUrls.length > 0) {
      const insertPhoto = db.prepare('INSERT INTO pet_photos (pet_id, photo_url) VALUES (?, ?)');
      for (const url of photoUrls) {
        insertPhoto.run(petId, url);
      }
    }

    // Add tags
    if (tags.length > 0) {
      const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
      const linkTag = db.prepare('INSERT INTO pet_tags (pet_id, tag_id) VALUES (?, ?)');
      
      for (const tag of tags) {
        insertTag.run(tag.name);
        const tagRecord = db.prepare('SELECT id FROM tags WHERE name = ?').get(tag.name);
        linkTag.run(petId, tagRecord.id);
      }
    }

    const createdPet = getPetWithDetails(petId);
    res.status(201).json(createdPet);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v3/pet - Store owner and admin only
router.put('/', authenticate, requireRoles(['store_owner', 'admin']), (req: Request, res: Response) => {
  try {
    const { id, name, category, photoUrls = [], tags = [], status } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Pet ID is required' });
    }

    const existingPet = db.prepare('SELECT * FROM pets WHERE id = ?').get(id);
    if (!existingPet) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    // Validate status transitions (business rule)
    if (status && status !== existingPet.status) {
      const userRole = req.user.role;
      
      // Only store_owner and admin can change sold pets back to available
      if (existingPet.status === 'sold' && !['store_owner', 'admin'].includes(userRole)) {
        return res.status(400).json({ error: 'Invalid status transition' });
      }
    }

    // Update category if provided
    let categoryId = existingPet.category_id;
    if (category) {
      let cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(category.name);
      if (!cat) {
        const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(category.name);
        categoryId = result.lastInsertRowid as number;
      } else {
        categoryId = cat.id;
      }
    }

    // Update pet
    db.prepare(`
      UPDATE pets 
      SET name = ?, category_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name || existingPet.name, categoryId, status || existingPet.status, id);

    // Update photos
    if (photoUrls.length > 0) {
      db.prepare('DELETE FROM pet_photos WHERE pet_id = ?').run(id);
      const insertPhoto = db.prepare('INSERT INTO pet_photos (pet_id, photo_url) VALUES (?, ?)');
      for (const url of photoUrls) {
        insertPhoto.run(id, url);
      }
    }

    // Update tags
    if (tags.length > 0) {
      db.prepare('DELETE FROM pet_tags WHERE pet_id = ?').run(id);
      const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
      const linkTag = db.prepare('INSERT INTO pet_tags (pet_id, tag_id) VALUES (?, ?)');
      
      for (const tag of tags) {
        insertTag.run(tag.name);
        const tagRecord = db.prepare('SELECT id FROM tags WHERE name = ?').get(tag.name);
        linkTag.run(id, tagRecord.id);
      }
    }

    const updatedPet = getPetWithDetails(id);
    res.json(updatedPet);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v3/pet/:petId - Store owner and admin only (form update)
router.post('/:petId', authenticate, requireRoles(['store_owner', 'admin']), (req: Request, res: Response) => {
  try {
    const petId = parseInt(req.params.petId);
    const { name, status } = req.body;

    const existingPet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
    if (!existingPet) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    db.prepare(`
      UPDATE pets 
      SET name = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name || existingPet.name, status || existingPet.status, petId);

    res.status(200).json({ message: 'Pet updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v3/pet/:petId - Store owner and admin only
router.delete('/:petId', authenticate, requireRoles(['store_owner', 'admin']), (req: Request, res: Response) => {
  try {
    const petId = parseInt(req.params.petId);

    // Pre-condition: Check for active orders
    const activeOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders 
      WHERE pet_id = ? AND status IN ('placed', 'approved')
    `).get(petId) as { count: number };

    if (activeOrders.count > 0) {
      return res.status(400).json({ error: 'Cannot delete pet with active orders' });
    }

    const result = db.prepare('DELETE FROM pets WHERE id = ?').run(petId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    res.status(200).json({ message: 'Pet deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v3/pet/:petId/uploadImage - Store owner and admin only
router.post('/:petId/uploadImage', authenticate, requireRoles(['store_owner', 'admin']), (req: Request, res: Response) => {
  try {
    const petId = parseInt(req.params.petId);
    const { additionalMetadata, file } = req.body;

    const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    // In a real implementation, you would handle file upload here
    // For this demo, we'll just simulate adding a photo URL
    const photoUrl = `https://example.com/uploads/pet${petId}_${Date.now()}.jpg`;
    
    db.prepare('INSERT INTO pet_photos (pet_id, photo_url) VALUES (?, ?)').run(petId, photoUrl);

    res.json({
      code: 200,
      type: 'success',
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;