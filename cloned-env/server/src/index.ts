import express from 'express';
import cors from 'cors';
import petRoutes from './routes/pets.js';
import storeRoutes from './routes/store.js';
import userRoutes from './routes/user.js';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: number;
        username: string;
        role: string;
      };
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v3/pet', petRoutes);
app.use('/api/v3/store', storeRoutes);
app.use('/api/v3/user', userRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Petstore API Server',
    version: '3.0',
    endpoints: {
      pets: '/api/v3/pet',
      store: '/api/v3/store',
      users: '/api/v3/user'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoints: http://localhost:${PORT}/api/v3`);
});

export default app;