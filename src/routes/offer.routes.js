const express = require('express');
const router = express.Router({ mergeParams: true }); // Pour accéder à :id depuis parent
const authMiddleware = require('../middlewares/auth');
const { createOffer, manageOffer, getOffers } = require('../controllers/offer.controller');

// GET /api/requests/:id/offers — Voir les offres d'une demande
router.get('/', authMiddleware, getOffers);

// POST /api/requests/:id/offers — Faire une offre (driver)
router.post('/', authMiddleware, createOffer);

// PUT /api/requests/:id/offers/:offerId — Gérer une offre (accept/decline/counter)
router.put('/:offerId', authMiddleware, manageOffer);

module.exports = router;
