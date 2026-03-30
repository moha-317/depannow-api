const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Créer un PaymentIntent Stripe
 * @param {Object} params
 * @param {number} params.amount - Montant en euros (ex: 50.00)
 * @param {string} [params.currency='eur'] - Devise
 * @param {Object} [params.metadata] - Métadonnées (requestId, clientId, driverId…)
 */
const createPaymentIntent = async ({ amount, currency = 'eur', metadata }) => {
  // amount en euros → on convertit en centimes pour Stripe
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    metadata,
    automatic_payment_methods: { enabled: true },
  });
};

/**
 * Vérifier et construire un événement webhook Stripe
 * @param {Buffer} payload - Corps brut de la requête
 * @param {string} sig - Header stripe-signature
 */
const constructWebhookEvent = (payload, sig) => {
  return stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
};

module.exports = { createPaymentIntent, constructWebhookEvent };
