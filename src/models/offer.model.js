const db = require('../config/db');

const OfferModel = {
  /**
   * Créer une nouvelle offre
   */
  async createOffer({ id, service_request_id, driver_id, price, is_counter_offer = false }) {
    const query = `
      INSERT INTO offers (id, service_request_id, driver_id, price, is_counter_offer, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `;
    const result = await db.query(query, [
      id,
      service_request_id,
      driver_id,
      price,
      is_counter_offer,
    ]);
    return result.rows[0];
  },

  /**
   * Vérifier si un driver a déjà une offre active (non counter) sur une demande
   */
  async driverHasActiveOffer(service_request_id, driver_id) {
    const query = `
      SELECT id FROM offers
      WHERE service_request_id = $1
        AND driver_id = $2
        AND status = 'pending'
        AND is_counter_offer = false
      LIMIT 1
    `;
    const result = await db.query(query, [service_request_id, driver_id]);
    return result.rows.length > 0;
  },

  /**
   * Récupérer toutes les offres d'une demande
   */
  async findByRequestId(service_request_id) {
    const query = `
      SELECT o.*,
             u.full_name AS driver_name,
             u.phone AS driver_phone,
             d.company_name,
             d.rating AS driver_rating
      FROM offers o
      JOIN drivers d ON d.id = o.driver_id
      JOIN users u ON u.id = d.user_id
      WHERE o.service_request_id = $1
      ORDER BY o.created_at ASC
    `;
    const result = await db.query(query, [service_request_id]);
    return result.rows;
  },

  /**
   * Trouver une offre par ID
   */
  async findById(id) {
    const query = `
      SELECT o.*,
             d.user_id AS driver_user_id,
             d.company_name
      FROM offers o
      JOIN drivers d ON d.id = o.driver_id
      WHERE o.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  },

  /**
   * Mettre à jour le statut d'une offre
   */
  async updateStatus(id, status) {
    const query = `
      UPDATE offers SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [id, status]);
    return result.rows[0] || null;
  },

  /**
   * Décliner toutes les autres offres pending d'une demande (quand une est acceptée)
   */
  async declineOtherOffers(service_request_id, accepted_offer_id) {
    const query = `
      UPDATE offers SET status = 'declined', updated_at = NOW()
      WHERE service_request_id = $1
        AND id != $2
        AND status = 'pending'
    `;
    await db.query(query, [service_request_id, accepted_offer_id]);
  },
};

module.exports = OfferModel;
