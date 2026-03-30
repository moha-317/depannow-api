const RequestModel = require('../models/request.model');
const PaymentModel = require('../models/payment.model');
const { createPaymentIntent, constructWebhookEvent } = require('../services/stripe.service');
const { getSocketService } = require('../services/socket.service');

/**
 * POST /api/payments/create-intent
 * Crée un PaymentIntent Stripe pour une demande de dépannage
 * Auth JWT requis
 */
const createIntent = async (req, res) => {
  try {
    const { requestId } = req.body;
    const clientId = req.user.id;

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'requestId est requis.' });
    }

    // 1. Récupérer la demande de service
    const serviceRequest = await RequestModel.findById(requestId);
    if (!serviceRequest) {
      return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    }

    // 2. Vérifier que le client est bien le propriétaire
    if (String(serviceRequest.client_id) !== String(clientId)) {
      return res.status(403).json({ success: false, message: 'Accès interdit : vous n\'êtes pas le propriétaire de cette demande.' });
    }

    // 3. Récupérer le montant final (prix accepté)
    const amount = parseFloat(serviceRequest.final_price);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Montant invalide. La demande doit avoir un prix final accepté.' });
    }

    // 4. Calculer commission et payout driver
    const commission = parseFloat((amount * 0.07).toFixed(2));
    const driverPayout = parseFloat((amount * 0.93).toFixed(2));

    // 5. Créer le PaymentIntent Stripe
    const paymentIntent = await createPaymentIntent({
      amount,
      currency: 'eur',
      metadata: {
        requestId,
        clientId: String(clientId),
        driverId: String(serviceRequest.accepted_driver_id || ''),
      },
    });

    // 6. Créer le record en BDD avec status 'pending'
    await PaymentModel.createPayment({
      requestId,
      clientId,
      driverId: serviceRequest.accepted_driver_id || null,
      amount,
      commission,
      driverPayout,
      stripePaymentId: paymentIntent.id,
    });

    // 7. Retourner les infos au client
    return res.status(201).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
        commission,
        driverPayout,
      },
    });
  } catch (err) {
    console.error('createIntent error:', err);
    return res.status(500).json({ success: false, message: 'Erreur lors de la création du paiement.', error: err.message });
  }
};

/**
 * POST /api/payments/webhook
 * Webhook Stripe — reçoit le raw body (pas de JSON parser !)
 * PAS d'auth JWT, mais vérification de signature Stripe
 */
const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).json({ success: false, message: 'Signature Stripe manquante.' });
  }

  let event;
  try {
    event = constructWebhookEvent(req.body, sig);
  } catch (err) {
    console.error('Webhook signature invalide:', err.message);
    return res.status(400).json({ success: false, message: `Webhook error: ${err.message}` });
  }

  const socketService = getSocketService();

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const { requestId, clientId, driverId } = paymentIntent.metadata;

        // Mettre à jour le statut du paiement → 'paid'
        await PaymentModel.updateStatus(paymentIntent.id, 'paid');

        // Mettre à jour la demande → 'completed'
        if (requestId) {
          await RequestModel.updateStatus(requestId, 'completed');
        }

        // Émettre socket event 'payment_confirmed' aux deux parties
        if (socketService) {
          const payload = {
            requestId,
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount / 100, // reconvertir en euros
            status: 'paid',
          };

          if (clientId) {
            const clientSocketId = socketService.userSockets.get(String(clientId));
            if (clientSocketId) {
              socketService.io.to(clientSocketId).emit('payment_confirmed', payload);
            }
          }

          if (driverId) {
            const driverSocketId = socketService.userSockets.get(String(driverId));
            if (driverSocketId) {
              socketService.io.to(driverSocketId).emit('payment_confirmed', payload);
            }
          }
        }

        console.log(`✅ Paiement confirmé — requestId: ${requestId}, paymentIntentId: ${paymentIntent.id}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;

        // Mettre à jour le statut du paiement → 'failed'
        await PaymentModel.updateStatus(paymentIntent.id, 'failed');

        console.log(`❌ Paiement échoué — paymentIntentId: ${paymentIntent.id}`);
        break;
      }

      default:
        console.log(`ℹ️  Événement Stripe ignoré : ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne webhook.' });
  }
};

module.exports = { createIntent, stripeWebhook };
