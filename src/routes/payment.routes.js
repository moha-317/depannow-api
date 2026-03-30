const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const { createIntent, stripeWebhook } = require('../controllers/payment.controller');

/**
 * POST /api/payments/webhook
 * ⚠️  IMPORTANT : doit recevoir le raw body — NE PAS utiliser express.json() sur cette route
 * Le raw body parser est configuré dans server.js AVANT express.json()
 * Pas d'auth JWT — signature Stripe utilisée à la place
 */
router.post('/webhook', stripeWebhook);

/**
 * POST /api/payments/create-intent
 * Crée un PaymentIntent Stripe pour une demande de service
 * Auth JWT requis
 */
router.post('/create-intent', authMiddleware, createIntent);

module.exports = router;
