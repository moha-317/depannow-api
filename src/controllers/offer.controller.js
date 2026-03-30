const { v4: uuidv4 } = require('uuid');
const OfferModel = require('../models/offer.model');
const RequestModel = require('../models/request.model');
const DriverModel = require('../models/driver.model');

/**
 * POST /api/requests/:id/offers
 * Faire une offre sur une demande (driver uniquement)
 */
const createOffer = async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les dépanneurs peuvent faire des offres.',
      });
    }

    const { id: requestId } = req.params;
    const { price, is_counter_offer = false } = req.body;

    if (!price || parseFloat(price) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le prix doit être un nombre positif.',
      });
    }

    // Vérifier que la demande existe et est ouverte
    const request = await RequestModel.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    }

    if (!['pending', 'negotiating'].includes(request.status)) {
      return res.status(409).json({
        success: false,
        message: `Cette demande n'est plus ouverte aux offres (statut: ${request.status}).`,
      });
    }

    // Récupérer le profil driver (on a besoin de l'ID drivers, pas user_id)
    const driverProfile = await DriverModel.findByUserId(req.user.id);
    if (!driverProfile) {
      return res.status(404).json({
        success: false,
        message: 'Profil dépanneur introuvable. Complétez votre profil.',
      });
    }

    // Règle : un driver ne peut faire qu'une offre initiale par demande
    if (!is_counter_offer) {
      const hasOffer = await OfferModel.driverHasActiveOffer(requestId, driverProfile.id);
      if (hasOffer) {
        return res.status(409).json({
          success: false,
          message: 'Vous avez déjà une offre active sur cette demande.',
        });
      }
    }

    const offer = await OfferModel.createOffer({
      id: uuidv4(),
      service_request_id: requestId,
      driver_id: driverProfile.id,
      price: parseFloat(price),
      is_counter_offer: Boolean(is_counter_offer),
    });

    // Mettre à jour le statut de la demande à 'negotiating' si encore 'pending'
    if (request.status === 'pending') {
      await RequestModel.updateStatus(requestId, 'negotiating');
    }

    return res.status(201).json({
      success: true,
      message: 'Offre envoyée avec succès.',
      data: offer,
    });
  } catch (err) {
    console.error('createOffer error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
};

/**
 * PUT /api/requests/:id/offers/:offerId
 * Gérer une offre : accept | decline | counter
 */
const manageOffer = async (req, res) => {
  try {
    const { id: requestId, offerId } = req.params;
    const { action, counter_price } = req.body;

    if (!['accept', 'decline', 'counter'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action invalide. Valeurs acceptées : 'accept', 'decline', 'counter'.",
      });
    }

    // Vérifier la demande
    const request = await RequestModel.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    }

    // Vérifier l'offre
    const offer = await OfferModel.findById(offerId);
    if (!offer || offer.service_request_id !== requestId) {
      return res.status(404).json({ success: false, message: 'Offre introuvable.' });
    }

    if (offer.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `Cette offre n'est plus en attente (statut: ${offer.status}).`,
      });
    }

    // ── ACCEPT ────────────────────────────────────────────────
    if (action === 'accept') {
      // Seul le client peut accepter une offre de driver
      // Ou le driver peut accepter une contre-offre du client
      const isClientAccepting = req.user.role === 'client' && req.user.id === request.client_id;
      const isDriverAcceptingCounter =
        req.user.role === 'driver' &&
        offer.is_counter_offer === true &&
        offer.driver_user_id === req.user.id;

      if (!isClientAccepting && !isDriverAcceptingCounter) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à accepter cette offre.",
        });
      }

      // Mettre à jour l'offre
      const updatedOffer = await OfferModel.updateStatus(offerId, 'accepted');

      // Mettre à jour la demande : status = accepted, accepted_driver_id, final_price
      const updatedRequest = await RequestModel.updateStatus(requestId, 'accepted', {
        accepted_driver_id: offer.driver_id,
        final_price: offer.price,
      });

      // Décliner toutes les autres offres
      await OfferModel.declineOtherOffers(requestId, offerId);

      return res.status(200).json({
        success: true,
        message: 'Offre acceptée. La demande est maintenant confirmée.',
        data: { offer: updatedOffer, request: updatedRequest },
      });
    }

    // ── DECLINE ───────────────────────────────────────────────
    if (action === 'decline') {
      const isClient = req.user.role === 'client' && req.user.id === request.client_id;
      const isDriverOwner = req.user.role === 'driver' && offer.driver_user_id === req.user.id;

      if (!isClient && !isDriverOwner) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à décliner cette offre.",
        });
      }

      const updatedOffer = await OfferModel.updateStatus(offerId, 'declined');

      return res.status(200).json({
        success: true,
        message: 'Offre déclinée.',
        data: updatedOffer,
      });
    }

    // ── COUNTER ───────────────────────────────────────────────
    if (action === 'counter') {
      if (!counter_price || parseFloat(counter_price) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'counter_price est requis et doit être positif pour une contre-offre.',
        });
      }

      const isClient = req.user.role === 'client' && req.user.id === request.client_id;
      if (!isClient) {
        return res.status(403).json({
          success: false,
          message: 'Seul le client peut faire une contre-offre.',
        });
      }

      // Décliner l'offre actuelle
      await OfferModel.updateStatus(offerId, 'declined');

      // Créer une nouvelle offre avec is_counter_offer = true
      const counterOffer = await OfferModel.createOffer({
        id: uuidv4(),
        service_request_id: requestId,
        driver_id: offer.driver_id,
        price: parseFloat(counter_price),
        is_counter_offer: true,
      });

      return res.status(201).json({
        success: true,
        message: 'Contre-offre envoyée au dépanneur.',
        data: counterOffer,
      });
    }
  } catch (err) {
    console.error('manageOffer error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
};

/**
 * GET /api/requests/:id/offers
 * Voir les offres d'une demande
 */
const getOffers = async (req, res) => {
  try {
    const { id: requestId } = req.params;

    const request = await RequestModel.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    }

    // Vérification d'accès
    const isOwner = req.user.id === request.client_id;
    const isDriver = req.user.role === 'driver';
    if (!isOwner && !isDriver) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    const offers = await OfferModel.findByRequestId(requestId);
    return res.status(200).json({ success: true, data: offers, count: offers.length });
  } catch (err) {
    console.error('getOffers error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
};

module.exports = { createOffer, manageOffer, getOffers };
