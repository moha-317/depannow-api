const db = require('../config/db');

const RequestModel = {
  /**
   * Créer une nouvelle demande de dépannage
   */
  async createRequest({
    id,
    client_id,
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
  }) {
    const query = `
      INSERT INTO service_requests (
        id, client_id, title, request_type,
        pickup_address, pickup_lat, pickup_lng,
        dropoff_address, dropoff_lat, dropoff_lng,
        latitude, longitude, address,
        vehicle_details, scheduled_at, initial_client_offer,
        status
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $6, $7, $5,
        $11, $12, $13,
        'pending'
      )
      RETURNING *
    `;
    const values = [
      id,
      client_id,
      `Demande de dépannage — ${request_type}`,
      request_type,
      pickup_address,
      pickup_lat,
      pickup_lng,
      dropoff_address || null,
      dropoff_lat || null,
      dropoff_lng || null,
      vehicle_details ? JSON.stringify(vehicle_details) : null,
      scheduled_at || null,
      initial_client_offer,
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  /**
   * Vérifier si un client a une demande active
   */
  async hasActiveRequest(client_id) {
    const query = `
      SELECT id FROM service_requests
      WHERE client_id = $1
        AND status IN ('pending', 'negotiating', 'accepted', 'in_progress')
      LIMIT 1
    `;
    const result = await db.query(query, [client_id]);
    return result.rows.length > 0;
  },

  /**
   * Récupérer les demandes d'un client
   */
  async findByClientId(client_id, status_filter) {
    let query = `
      SELECT sr.*, 
             u.full_name AS client_name,
             u.phone AS client_phone
      FROM service_requests sr
      JOIN users u ON u.id = sr.client_id
      WHERE sr.client_id = $1
    `;
    const values = [client_id];

    if (status_filter) {
      query += ` AND sr.status = $2`;
      values.push(status_filter);
    }

    query += ` ORDER BY sr.created_at DESC`;

    const result = await db.query(query, values);
    return result.rows;
  },

  /**
   * Trouver les demandes à proximité pour un driver (Haversine en JS)
   * On récupère toutes les demandes pending/negotiating, puis on filtre côté app
   */
  async findNearby({ lat, lng, radius = 20, status_filter }) {
    const statuses = status_filter
      ? [status_filter]
      : ['pending', 'negotiating'];

    const placeholders = statuses.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      SELECT sr.*,
             u.full_name AS client_name,
             u.phone AS client_phone
      FROM service_requests sr
      JOIN users u ON u.id = sr.client_id
      WHERE sr.status IN (${placeholders})
        AND sr.pickup_lat IS NOT NULL
        AND sr.pickup_lng IS NOT NULL
      ORDER BY sr.created_at DESC
    `;

    const result = await db.query(query, statuses);

    // Filtre Haversine côté application
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;

    return result.rows
      .map((row) => {
        const lat2 = parseFloat(row.pickup_lat);
        const lng2 = parseFloat(row.pickup_lng);
        const dLat = toRad(lat2 - lat);
        const dLng = toRad(lng2 - lng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        const distance = 2 * R * Math.asin(Math.sqrt(a));
        return { ...row, distance_km: parseFloat(distance.toFixed(2)) };
      })
      .filter((row) => row.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km);
  },

  /**
   * Trouver une demande par ID
   */
  async findById(id) {
    const query = `
      SELECT sr.*, u.full_name AS client_name, u.phone AS client_phone
      FROM service_requests sr
      JOIN users u ON u.id = sr.client_id
      WHERE sr.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  },

  /**
   * Trouver les demandes actives assignées à un driver (pour les mises à jour GPS)
   */
  async findActiveByDriverId(driver_user_id) {
    const query = `
      SELECT sr.id, sr.client_id
      FROM service_requests sr
      JOIN drivers d ON d.id = sr.accepted_driver_id
      WHERE d.user_id = $1
        AND sr.status IN ('accepted', 'in_progress')
    `;
    const result = await db.query(query, [driver_user_id]);
    return result.rows;
  },

  /**
   * Mettre à jour le statut d'une demande
   */
  async updateStatus(id, status, extra = {}) {
    const sets = ['status = $2', 'updated_at = NOW()'];
    const values = [id, status];
    let i = 3;

    if (extra.accepted_driver_id !== undefined) {
      sets.push(`accepted_driver_id = $${i++}`);
      values.push(extra.accepted_driver_id);
    }
    if (extra.final_price !== undefined) {
      sets.push(`final_price = $${i++}`);
      values.push(extra.final_price);
    }

    const query = `
      UPDATE service_requests SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, values);
    return result.rows[0] || null;
  },
};

module.exports = RequestModel;
