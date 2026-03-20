import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import validationRoutes from './routes/validationRoutes.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic rate limiting could be added here using express-rate-limit
// e.g., app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }))

// Routes
app.use('/api/tickets', validationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error:', err.message, ']');
  res.status(500).json({ status: 'ERROR', message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Ticket Validation API running on http://localhost:${PORT}`);
});
