const db = require('../config/db');

const PaymentModel = {
  /**
   * Créer un enregistrement de paiement
   * @param {Object} params
   * @param {string} params.requestId
   * @param {string} params.clientId
   * @param {string} params.driverId
   * @param {number} params.amount         - Montant total en euros
   * @param {number} params.commission     - Commission plateforme (7%)
   * @param {number} params.driverPayout   - Part driver (93%)
   * @param {string} params.stripePaymentId - PaymentIntent ID Stripe
   */
  async createPayment({ requestId, clientId, driverId, amount, commission, driverPayout, stripePaymentId }) {
    const query = `
      INSERT INTO payments (
        request_id, client_id, driver_id,
        amount, commission, driver_payout,
        stripe_payment_id, status,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW())
      RETURNING *
    `;
    const values = [requestId, clientId, driverId, amount, commission, driverPayout, stripePaymentId];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  /**
   * Trouver un paiement par requestId
   * @param {string} requestId
   */
  async findByRequestId(requestId) {
    const query = `
      SELECT * FROM payments
      WHERE request_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await db.query(query, [requestId]);
    return result.rows[0] || null;
  },

  /**
   * Mettre à jour le statut d'un paiement
   * @param {string} stripePaymentId - PaymentIntent ID Stripe
   * @param {string} status          - 'pending' | 'paid' | 'failed'
   */
  async updateStatus(stripePaymentId, status) {
    const query = `
      UPDATE payments
      SET status = $2, updated_at = NOW()
      WHERE stripe_payment_id = $1
      RETURNING *
    `;
    const result = await db.query(query, [stripePaymentId, status]);
    return result.rows[0] || null;
  },
};

module.exports = PaymentModel;
