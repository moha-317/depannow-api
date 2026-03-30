const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth');

// POST /api/auth/register — Inscription
router.post('/register', register);

// POST /api/auth/login — Connexion
router.post('/login', login);

// GET /api/users/me — Profil utilisateur connecté (protégé)
// Note: cette route est montée séparément dans server.js sous /api/users
router.get('/me', authMiddleware, getMe);

module.exports = router;
