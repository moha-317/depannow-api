require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const notificationRoutes = require('./routes/notification.routes');
const authMiddleware = require('./middlewares/auth');
const { getMe } = require('./controllers/auth.controller');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares globaux ─────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'DépanNow API is running 🚗',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Auth routes : /api/auth/register, /api/auth/login
app.use('/api/auth', authRoutes);

// User routes : /api/users/me
app.get('/api/users/me', authMiddleware, getMe);

// Notification routes : /api/notifications
app.use('/api/notifications', notificationRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} introuvable.`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Erreur non gérée :', err.stack);
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur.',
  });
});

// ─── Démarrage ────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 DépanNow API démarré sur le port ${PORT}`);
  console.log(`📍 Environnement : ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
