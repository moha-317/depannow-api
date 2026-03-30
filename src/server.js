require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth.routes');
const notificationRoutes = require('./routes/notification.routes');
const requestRoutes = require('./routes/request.routes');
const offerRoutes = require('./routes/offer.routes');
const driverRoutes = require('./routes/driver.routes');
const paymentRoutes = require('./routes/payment.routes');
const authMiddleware = require('./middlewares/auth');
const { getMe } = require('./controllers/auth.controller');
const { initSocketService } = require('./services/socket.service');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares globaux ─────────────────────────────────────────────────────

const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// ─── Webhook Stripe — AVANT express.json() (raw body requis) ──────────────────
// Cette route doit recevoir le corps brut pour valider la signature Stripe
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentRoutes);

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

// ─── Sprint 3 — Routes Métier ─────────────────────────────────────────────────

// Request routes : /api/requests
app.use('/api/requests', requestRoutes);

// Offer routes nested under requests : /api/requests/:id/offers
app.use('/api/requests/:id/offers', offerRoutes);

// Driver routes : /api/drivers
app.use('/api/drivers', driverRoutes);

// ─── Sprint 5 — Paiement Stripe ───────────────────────────────────────────────

// Payment routes : /api/payments (create-intent + webhook déjà monté avant express.json)
app.use('/api/payments', paymentRoutes);

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

// ─── Création du serveur HTTP + Socket.io ─────────────────────────────────────

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
});

// Initialiser le service WebSocket (singleton)
initSocketService(io);

// ─── Démarrage ────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`🚀 DépanNow API démarré sur le port ${PORT}`);
  console.log(`📍 Environnement : ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 WebSocket Socket.io activé`);
});

module.exports = app;
