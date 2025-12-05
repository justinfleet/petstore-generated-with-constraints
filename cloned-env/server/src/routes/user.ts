import { Router, Request, Response } from 'express';
import db from '../lib/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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

// Ownership check for users
const checkUserOwnership = (req: Request, res: Response, next: Function) => {
  const username = req.params.username;
  const currentUsername = req.user.username;
  const userRole = req.user.role;

  // Admin can access all users
  if (userRole === 'admin') {
    return next();
  }

  // Users can only access their own profile
  if (username !== currentUsername) {
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
};

// POST /api/v3/user - Registration (public per spec)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, firstName, lastName, email, password, phone, userStatus = 1 } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = db.prepare(`
      INSERT INTO users (username, first_name, last_name, email, password, phone, user_status, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'customer')
    `).run(username, firstName, lastName, email, hashedPassword, phone, userStatus);

    const userId = result.lastInsertRowid as number;

    // Get created user (includes password per spec)
    const user = db.prepare(`
      SELECT id, username, first_name as firstName, last_name as lastName, 
             email, password, phone, user_status as userStatus
      FROM users WHERE id = ?
    `).get(userId);

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v3/user/createWithList - Batch user creation (public per spec)
router.post('/createWithList', async (req: Request, res: Response) => {
  try {
    const users = req.body;
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'Array of users is required' });
    }

    const results = [];
    
    for (const userData of users) {
      const { username, firstName, lastName, email, password, phone, userStatus = 1 } = userData;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required for all users' });
      }

      // Check if user already exists
      const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
      if (existingUser) {
        continue; // Skip existing users
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const result = db.prepare(`
        INSERT INTO users (username, first_name, last_name, email, password, phone, user_status, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'customer')
      `).run(username, firstName, lastName, email, hashedPassword, phone, userStatus);

      const userId = result.lastInsertRowid as number;

      // Get created user (includes password per spec)
      const user = db.prepare(`
        SELECT id, username, first_name as firstName, last_name as lastName, 
               email, password, phone, user_status as userStatus
        FROM users WHERE id = ?
      `).get(userId);

      results.push(user);
    }

    // Return the last created user as per spec response type
    res.status(201).json(results[results.length - 1] || {});
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v3/user/login - Login (public per spec)
router.get('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.query;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Get user with password
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username as string);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password as string, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    // Return token as per API spec
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v3/user/logout - Logout (public per spec)
router.get('/logout', (req: Request, res: Response) => {
  // In a stateless JWT system, logout is handled client-side
  res.json({ message: 'Logged out successfully' });
});

// GET /api/v3/user/:username - No auth required per spec but add for business logic
router.get('/:username', authenticate, checkUserOwnership, (req: Request, res: Response) => {
  try {
    const username = req.params.username;
    
    const user = db.prepare(`
      SELECT id, username, first_name as firstName, last_name as lastName,
             email, password, phone, user_status as userStatus
      FROM users WHERE username = ?
    `).get(username);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v3/user/:username - No auth required per spec but add for business logic
router.put('/:username', authenticate, checkUserOwnership, async (req: Request, res: Response) => {
  try {
    const username = req.params.username;
    const { firstName, lastName, email, password, phone, userStatus, role } = req.body;
    const currentUserRole = req.user.role;

    const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only admin can change roles
    if (role && role !== existingUser.role && currentUserRole !== 'admin') {
      return res.status(403).json({ error: 'Only admin can change user roles' });
    }

    // Prepare update data
    const updates: any = {};
    if (firstName !== undefined) updates.first_name = firstName;
    if (lastName !== undefined) updates.last_name = lastName;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (userStatus !== undefined) updates.user_status = userStatus;
    if (role !== undefined && currentUserRole === 'admin') updates.role = role;

    // Handle password update
    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }

    // Build dynamic update query
    const updateKeys = Object.keys(updates);
    if (updateKeys.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = updateKeys.map(key => `${key} = ?`).join(', ');
    const values = updateKeys.map(key => updates[key]);
    
    db.prepare(`UPDATE users SET ${setClause} WHERE username = ?`).run(...values, username);

    // Return updated user (includes password per spec)
    const updatedUser = db.prepare(`
      SELECT id, username, first_name as firstName, last_name as lastName,
             email, password, phone, user_status as userStatus
      FROM users WHERE username = ?
    `).get(username);

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v3/user/:username - No auth required per spec but add for business logic
router.delete('/:username', authenticate, requireRoles(['admin']), (req: Request, res: Response) => {
  try {
    const username = req.params.username;

    // Pre-condition: Check for active orders
    const activeOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders 
      WHERE user_id = (SELECT id FROM users WHERE username = ?) 
      AND status IN ('placed', 'approved')
    `).get(username) as { count: number };

    if (activeOrders.count > 0) {
      return res.status(400).json({ error: 'Cannot delete user with active orders' });
    }

    const result = db.prepare('DELETE FROM users WHERE username = ?').run(username);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;