const { v4: uuidv4 } = require('uuid');
const OfferModel = require('../models/offer.model');
const RequestModel = require('../models/request.model');
const DriverModel = require('../models/driver.model');
const { getSocketService } = require('../services/socket.service');

/**
 * POST /api/requests/:requestId/offers
 * Un driver crée une offre sur une demande
 */
const createOffer = async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les dépanneurs peuvent créer des offres.',
      });
    }

        const requestId = req.params.requestId || req.params.id;
    const { price, is_counter_offer } = req.body;

    if (!price || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le prix doit être positif.',
      });
    }

    // Vérifier que la demande existe et est en cours
    const request = await RequestModel.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Demande introuvable.',
      });
    }
    if (!['pending', 'negotiating'].includes(request.status)) {
      return res.status(409).json({
        success: false,
        message: 'Cette demande n\'accepte plus d\'offres.',
      });
    }

    // Récupérer le profil driver pour obtenir l'ID driver
    const driver = await DriverModel.findByUserId(req.user.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil dépanneur introuvable.',
      });
    }

    // Vérifier que le driver n'a pas déjà une offre active sur cette demande
    if (!is_counter_offer) {
      const hasOffer = await OfferModel.driverHasActiveOffer(requestId, driver.id);
      if (hasOffer) {
        return res.status(409).json({
          success: false,
          message: 'Vous avez déjà une offre en attente sur cette demande.',
        });
      }
    }

    const offer = await OfferModel.createOffer({
      id: uuidv4(),
      service_request_id: requestId,
      driver_id: driver.id,
      price: parseFloat(price),
      is_counter_offer: is_counter_offer || false,
    });

    // Mettre à jour le statut de la demande en 'negotiating'
    if (request.status === 'pending') {
      await RequestModel.updateStatus(requestId, 'negotiating');
    }

    // ─── WebSocket : notifier le client de la nouvelle offre ─────────────────
    try {
      const socketService = getSocketService();
      if (socketService) {
        socketService.notifyClient(request.client_id, {
          ...offer,
          driver_name: driver.full_name,
          driver_phone: driver.phone,
          company_name: driver.company_name,
          driver_rating: driver.rating,
        });
      }
    } catch (socketErr) {
      console.error('WebSocket notifyClient error:', socketErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Offre soumise avec succès.',
      data: offer,
    });
  } catch (err) {
    console.error('createOffer error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
};

/**
 * GET /api/requests/:requestId/offers
 * Lister les offres d'une demande (client uniquement ou driver pour sa propre offre)
 */
const getOffers = async (req, res) => {
  try {
    const requestId = req.params.requestId || req.params.id;

    const request = await RequestModel.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Demande introuvable.',
      });
    }

    // Client : seulement ses propres demandes
    if (req.user.role === 'client' && request.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé.',
      });
    }

    const offers = await OfferModel.findByRequestId(requestId);

    return res.status(200).json({
      success: true,
      data: offers,
      count: offers.length,
    });
  } catch (err) {
    console.error('getOffers error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
};

/**
 * PATCH /api/offers/:offerId/accept
 * Le client accepte une offre
 */
const acceptOffer = async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les clients peuvent accepter des offres.',
      });
    }

    const { offerId } = req.params;

    const offer = await OfferModel.findById(offerId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offre introuvable.',
      });
    }

    // Vérifier que la demande appartient au client
    const request = await RequestModel.findById(offer.service_request_id);
    if (!request || request.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé.',
      });
    }

    if (offer.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: 'Cette offre ne peut plus être acceptée.',
      });
    }

    // Accepter l'offre + mettre à jour la demande
    const [acceptedOffer, updatedRequest] = await Promise.all([
      OfferModel.updateStatus(offerId, 'accepted'),
      RequestModel.updateStatus(offer.service_request_id, 'accepted', {
        accepted_driver_id: offer.driver_id,
        final_price: offer.price,
      }),
    ]);

    // Décliner toutes les autres offres
    await OfferModel.declineOtherOffers(offer.service_request_id, offerId);

    // Récupérer les infos du driver pour la notification
    const driver = await DriverModel.findByUserId(offer.driver_user_id);

    // ─── WebSocket : notifier le dépanneur que son offre est acceptée ─────────
    try {
      const socketService = getSocketService();
      if (socketService) {
        socketService.notifyDriver(offer.driver_user_id, {
          offer: acceptedOffer,
          request: updatedRequest,
          message: 'Votre offre a été acceptée !',
        });
      }
    } catch (socketErr) {
      console.error('WebSocket notifyDriver error:', socketErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Offre acceptée avec succès.',
      data: {
        offer: acceptedOffer,
        request: updatedRequest,
        driver: driver || null,
      },
    });
  } catch (err) {
    console.error('acceptOffer error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
};

/**
 * PUT /api/requests/:id/offers/:offerId
 * Gérer une offre : accept / decline / counter
 */
const manageOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { action, price } = req.body;

    if (!['accept', 'decline', 'counter'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action invalide. Valeurs acceptées : accept, decline, counter.',
      });
    }

    const offer = await OfferModel.findById(offerId);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offre introuvable.' });
    }

    const request = await RequestModel.findById(offer.service_request_id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    }

    // Seul le client peut accept/decline, le driver peut counter
    if (action === 'accept' || action === 'decline') {
      if (req.user.role !== 'client' || request.client_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
      }
    }

    if (action === 'counter') {
      if (req.user.role !== 'client' || request.client_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
      }
      if (!price || price <= 0) {
        return res.status(400).json({ success: false, message: 'Prix de contre-offre invalide.' });
      }
    }

    if (action === 'accept') {
      const [acceptedOffer, updatedRequest] = await Promise.all([
        OfferModel.updateStatus(offerId, 'accepted'),
        RequestModel.updateStatus(offer.service_request_id, 'accepted', {
          accepted_driver_id: offer.driver_id,
          final_price: offer.price,
        }),
      ]);
      await OfferModel.declineOtherOffers(offer.service_request_id, offerId);

      // WebSocket : notifier le dépanneur
      try {
        const socketService = getSocketService();
        if (socketService) {
          socketService.notifyDriver(offer.driver_user_id, {
            offer: acceptedOffer,
            request: updatedRequest,
            message: 'Votre offre a été acceptée !',
          });
        }
      } catch (socketErr) {
        console.error('WebSocket notifyDriver error:', socketErr);
      }

      return res.status(200).json({
        success: true,
        message: 'Offre acceptée.',
        data: { offer: acceptedOffer, request: updatedRequest },
      });
    }

    if (action === 'decline') {
      const declined = await OfferModel.updateStatus(offerId, 'declined');
      return res.status(200).json({ success: true, message: 'Offre refusée.', data: declined });
    }

    if (action === 'counter') {
      const driver = await DriverModel.findByUserId(offer.driver_user_id);
      const counterOffer = await OfferModel.createOffer({
        id: uuidv4(),
        service_request_id: offer.service_request_id,
        driver_id: offer.driver_id,
        price: parseFloat(price),
        is_counter_offer: true,
      });

      // WebSocket : notifier le dépanneur de la contre-offre
      try {
        const socketService = getSocketService();
        if (socketService) {
          socketService.notifyDriver(offer.driver_user_id, {
            offer: counterOffer,
            type: 'counter_offer',
            message: 'Le client a fait une contre-offre.',
          });
        }
      } catch (socketErr) {
        console.error('WebSocket notifyDriver (counter) error:', socketErr);
      }

      return res.status(201).json({ success: true, message: 'Contre-offre envoyée.', data: counterOffer });
    }
  } catch (err) {
    console.error('manageOffer error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
};

module.exports = { createOffer, getOffers, acceptOffer, manageOffer };
