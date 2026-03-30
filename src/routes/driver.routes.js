const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const {
  getNearbyDrivers,
  updateLocation,
  updateAvailability,
} = require('../controllers/driver.controller');

// GET /api/drivers/nearby — Dépanneurs disponibles à proximité (public ou auth)
router.get('/nearby', getNearbyDrivers);

// PUT /api/drivers/me/location — Mise à jour position GPS (driver auth)
router.put('/me/location', authMiddleware, updateLocation);

// PUT /api/drivers/me/availability — Toggle disponibilité (driver auth)
router.put('/me/availability', authMiddleware, updateAvailability);

module.exports = router;
