const DriverModel = require('../models/driver.model');

/**
 * GET /api/drivers/nearby?lat=...&lng=...&radius=20
 * Trouver les dépanneurs disponibles à proximité
 */
const getNearbyDrivers = async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    if (lat == null || lng == null) {
      return res.status(400).json({
        success: false,
        message: 'Les paramètres lat et lng sont requis.',
      });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const searchRadius = radius ? parseFloat(radius) : 20;

    if (isNaN(parsedLat) || isNaN(parsedLng) || isNaN(searchRadius)) {
      return res.status(400).json({
        success: false,
        message: 'lat, lng et radius doivent être des nombres valides.',
      });
    }

    const drivers = await DriverModel.findNearby({
      lat: parsedLat,
      lng: parsedLng,
      radius: searchRadius,
    });

    // Masquer les données sensibles
    const safeDrivers = drivers.map(({ password_hash, ...d }) => d);

    return res.status(200).json({
      success: true,
      data: safeDrivers,
      count: safeDrivers.length,
    });
  } catch (err) {
    console.error('getNearbyDrivers error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
};

/**
 * PUT /api/drivers/me/location
 * Mettre à jour la position GPS du driver connecté
 */
const updateLocation = async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les dépanneurs peuvent mettre à jour leur position.',
      });
    }

    const { lat, lng } = req.body;

    if (lat == null || lng == null) {
      return res.status(400).json({
        success: false,
        message: 'lat et lng sont requis.',
      });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({
        success: false,
        message: 'lat et lng doivent être des nombres valides.',
      });
    }

    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Coordonnées GPS hors limites.',
      });
    }

    const driver = await DriverModel.updateLocation(req.user.id, parsedLat, parsedLng);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil dépanneur introuvable.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Position mise à jour.',
      data: driver,
    });
  } catch (err) {
    console.error('updateLocation error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
};

/**
 * PUT /api/drivers/me/availability
 * Toggle la disponibilité du driver connecté
 */
const updateAvailability = async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les dépanneurs peuvent modifier leur disponibilité.',
      });
    }

    const { is_available } = req.body;

    if (is_available == null || typeof is_available !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_available doit être un booléen (true ou false).',
      });
    }

    const driver = await DriverModel.updateAvailability(req.user.id, is_available);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil dépanneur introuvable.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Disponibilité mise à jour : ${is_available ? 'disponible' : 'indisponible'}.`,
      data: driver,
    });
  } catch (err) {
    console.error('updateAvailability error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
};

module.exports = { getNearbyDrivers, updateLocation, updateAvailability };
