const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const { createRequest, getRequests } = require('../controllers/request.controller');

// POST /api/requests — Créer une demande (client)
router.post('/', authMiddleware, createRequest);

// GET /api/requests — Lister les demandes (client: les siennes | driver: à proximité)
router.get('/', authMiddleware, getRequests);

module.exports = router;
