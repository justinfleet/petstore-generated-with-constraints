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

// Ownership check for orders
const checkOrderOwnership = (req: Request, res: Response, next: Function) => {
  const orderId = parseInt(req.params.orderId);
  const userId = req.user.user_id;
  const userRole = req.user.role;

  // Store owners and admins can access all orders
  if (['store_owner', 'admin'].includes(userRole)) {
    return next();
  }

  // Customers can only access their own orders
  const order = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (order.user_id !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
};

// GET /api/v3/store/inventory - Store owner and admin only
router.get('/inventory', authenticate, requireRoles(['store_owner', 'admin']), (req: Request, res: Response) => {
  try {
    const inventory = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM pets 
      GROUP BY status
    `).all();

    const result: { [key: string]: number } = {};
    for (const item of inventory) {
      result[item.status] = item.count;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v3/store/order - All authenticated users can place orders per business requirements
router.post('/order', authenticate, requireRoles(['customer', 'store_owner', 'admin']), (req: Request, res: Response) => {
  try {
    const { petId, quantity = 1, shipDate, status = 'placed', complete = false } = req.body;
    const userId = req.user.user_id;

    if (!petId) {
      return res.status(400).json({ error: 'Pet ID is required' });
    }

    // Validation: Quantity must be 1 for live animals
    if (quantity !== 1) {
      return res.status(400).json({ error: 'Quantity must be 1 for live animals' });
    }

    // Get pet and validate availability
    const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    // Validation: Pet must be available
    if (pet.status !== 'available') {
      return res.status(400).json({ error: 'Pet is not available for purchase' });
    }

    // Validation: Pet cannot have active orders
    const activeOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders 
      WHERE pet_id = ? AND status IN ('placed', 'approved')
    `).get(petId) as { count: number };

    if (activeOrders.count > 0) {
      return res.status(400).json({ error: 'Pet already has an active order' });
    }

    // Begin transaction
    const transaction = db.transaction(() => {
      // Create order
      const orderResult = db.prepare(`
        INSERT INTO orders (pet_id, user_id, quantity, ship_date, status, complete)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(petId, userId, quantity, shipDate, status, complete ? 1 : 0);

      const orderId = orderResult.lastInsertRowid as number;

      // State transition: Change pet status to pending
      db.prepare('UPDATE pets SET status = ? WHERE id = ?').run('pending', petId);

      return orderId;
    });

    const orderId = transaction();

    // Return the created order
    const order = db.prepare(`
      SELECT id, pet_id as petId, quantity, ship_date as shipDate, status, complete
      FROM orders WHERE id = ?
    `).get(orderId);

    res.status(201).json({
      ...order,
      complete: Boolean(order.complete)
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v3/store/order/:orderId - Authenticated with ownership check per business requirements
router.get('/order/:orderId', authenticate, checkOrderOwnership, (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.orderId);
    
    const order = db.prepare(`
      SELECT id, pet_id as petId, quantity, ship_date as shipDate, status, complete
      FROM orders WHERE id = ?
    `).get(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({
      ...order,
      complete: Boolean(order.complete)
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v3/store/order/:orderId - Store owner and admin only (added endpoint per business requirements)
router.put('/order/:orderId', authenticate, requireRoles(['store_owner', 'admin']), (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const { status, complete } = req.body;

    const existingOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Validation: Cannot modify delivered orders
    if (existingOrder.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot modify delivered orders' });
    }

    // Begin transaction for state transitions
    const transaction = db.transaction(() => {
      // Update order
      db.prepare(`
        UPDATE orders 
        SET status = ?, complete = ?
        WHERE id = ?
      `).run(status || existingOrder.status, complete !== undefined ? (complete ? 1 : 0) : existingOrder.complete, orderId);

      // State transition: If order is delivered, mark pet as sold
      if (status === 'delivered') {
        db.prepare('UPDATE pets SET status = ? WHERE id = ?').run('sold', existingOrder.pet_id);
      }
    });

    transaction();

    // Return updated order
    const updatedOrder = db.prepare(`
      SELECT id, pet_id as petId, quantity, ship_date as shipDate, status, complete
      FROM orders WHERE id = ?
    `).get(orderId);

    res.json({
      ...updatedOrder,
      complete: Boolean(updatedOrder.complete)
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v3/store/order/:orderId - Authenticated with ownership check per business requirements
router.delete('/order/:orderId', authenticate, checkOrderOwnership, (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.orderId);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Pre-condition: Can only cancel placed orders
    if (order.status !== 'placed') {
      return res.status(400).json({ error: 'Can only cancel orders with \'placed\' status' });
    }

    // Begin transaction for state transitions
    const transaction = db.transaction(() => {
      // Delete order
      db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);

      // State transition: Return pet to available status
      db.prepare('UPDATE pets SET status = ? WHERE id = ?').run('available', order.pet_id);
    });

    transaction();

    res.status(200).json({ message: 'Order cancelled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;