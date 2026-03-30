const { v4: uuidv4 } = require('uuid');
const RequestModel = require('../models/request.model');
const DriverModel = require('../models/driver.model');
const { getSocketService } = require('../services/socket.service');

/**
 * POST /api/requests
 * Créer une demande de dépannage (client uniquement)
 */
const createRequest = async (req, res) => {
  try {
    // Vérifier le rôle
    if (req.user.role !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les clients peuvent créer des demandes.',
      });
    }

    const {
      request_type,
      pickup_address,
      pickup_lat,
      pickup_lng,
      dropoff_address,
      dropoff_lat,
      dropoff_lng,
      vehicle_details,
      scheduled_at,
      initial_client_offer,
    } = req.body;

    // Validation des champs requis
    if (!request_type || !pickup_address || pickup_lat == null || pickup_lng == null) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis manquants : request_type, pickup_address, pickup_lat, pickup_lng.',
      });
    }

    if (!vehicle_details) {
      return res.status(400).json({
        success: false,
        message: 'vehicle_details est requis.',
      });
    }

    if (initial_client_offer == null || initial_client_offer <= 0) {
      return res.status(400).json({
        success: false,
        message: 'initial_client_offer est requis et doit être positif.',
      });
    }

    // Règle métier : un client ne peut avoir qu'une demande active à la fois
    const hasActive = await RequestModel.hasActiveRequest(req.user.id);
    if (hasActive) {
      return res.status(409).json({
        success: false,
        message: 'Vous avez déjà une demande active. Attendez qu\'elle soit terminée ou annulée.',
      });
    }

    const request = await RequestModel.createRequest({
      id: uuidv4(),
      client_id: req.user.id,
      request_type,
      pickup_address,
      pickup_lat: parseFloat(pickup_lat),
      pickup_lng: parseFloat(pickup_lng),
      dropoff_address: dropoff_address || null,
      dropoff_lat: dropoff_lat ? parseFloat(dropoff_lat) : null,
      dropoff_lng: dropoff_lng ? parseFloat(dropoff_lng) : null,
      vehicle_details,
      scheduled_at: scheduled_at || null,
      initial_client_offer: parseFloat(initial_client_offer),
    });

    return res.status(201).json({
      success: true,
      message: 'Demande de dépannage créée avec succès.',
      data: request,
    });
  } catch (err) {
    console.error('createRequest error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
};

/**
 * GET /api/requests
 * Lister les demandes selon le rôle
 * - Client : ses propres demandes
 * - Driver : demandes pending/negotiating à proximité
 * Query params: ?status=pending&lat=48.8&lng=2.3&radius=20
 */
const getRequests = async (req, res) => {
  try {
    const { status, lat, lng, radius } = req.query;

    if (req.user.role === 'client') {
      const requests = await RequestModel.findByClientId(req.user.id, status || null);
      return res.status(200).json({
        success: true,
        data: requests,
        count: requests.length,
      });
    }

    if (req.user.role === 'driver') {
      // Pour un driver, retourner les demandes à proximité
      const driverLat = lat ? parseFloat(lat) : null;
      const driverLng = lng ? parseFloat(lng) : null;
      const searchRadius = radius ? parseFloat(radius) : 20;

      if (driverLat == null || driverLng == null) {
        return res.status(400).json({
          success: false,
          message: 'Les paramètres lat et lng sont requis pour les drivers.',
        });
      }

      const requests = await RequestModel.findNearby({
        lat: driverLat,
        lng: driverLng,
        radius: searchRadius,
        status_filter: status || null,
      });

      return res.status(200).json({
        success: true,
        data: requests,
        count: requests.length,
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Accès non autorisé.',
    });
  } catch (err) {
    console.error('getRequests error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
};

module.exports = { createRequest, getRequests };
