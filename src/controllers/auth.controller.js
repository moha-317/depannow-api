const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UserModel = require('../models/user.model');
require('dotenv').config();

const BCRYPT_SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = '7d';

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur
 */
const register = async (req, res) => {
  try {
    const { full_name, email, phone, password, role } = req.body;

    // Validation des champs obligatoires
    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont obligatoires : full_name, email, phone, password.',
      });
    }

    // Validation email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'email invalide.',
      });
    }

    // Validation mot de passe (min 6 caractères)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 6 caractères.',
      });
    }

    // Vérifier si l'email est déjà utilisé
    const emailExists = await UserModel.emailExists(email);
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: 'Un compte avec cet email existe déjà.',
      });
    }

    // Validation du rôle
    const validRoles = ['client', 'driver'];
    const userRole = role && validRoles.includes(role) ? role : 'client';

    // Hashage du mot de passe
    const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Création de l'utilisateur
    const newUser = await UserModel.create({
      id: uuidv4(),
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password_hash,
      role: userRole,
    });

    // Génération du token JWT
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      success: true,
      message: 'Compte créé avec succès.',
      data: {
        user: newUser,
        token,
      },
    });
  } catch (error) {
    console.error('Erreur register :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'inscription.',
    });
  }
};

/**
 * POST /api/auth/login
 * Connexion d'un utilisateur existant
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation des champs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe sont obligatoires.',
      });
    }

    // Rechercher l'utilisateur
    const user = await UserModel.findByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect.',
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect.',
      });
    }

    // Génération du token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Retourner l'utilisateur sans le hash du mot de passe
    const { password_hash, ...userWithoutPassword } = user;

    return res.status(200).json({
      success: true,
      message: 'Connexion réussie.',
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error) {
    console.error('Erreur login :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion.',
    });
  }
};

/**
 * GET /api/users/me
 * Récupérer le profil de l'utilisateur connecté
 */
const getMe = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable.',
      });
    }

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Erreur getMe :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur.',
    });
  }
};

module.exports = { register, login, getMe };
