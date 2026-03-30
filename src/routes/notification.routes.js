const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markNotificationAsRead,
} = require('../controllers/notification.controller');
const authMiddleware = require('../middlewares/auth');

// Toutes les routes notifications sont protégées par JWT
router.use(authMiddleware);

// GET /api/notifications — Liste des notifications
router.get('/', getNotifications);

// PUT /api/notifications/:id/read — Marquer comme lue
router.put('/:id/read', markNotificationAsRead);

module.exports = router;
