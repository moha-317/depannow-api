const db = require('../config/db');

const DriverModel = {
  /**
   * Mettre à jour la position GPS d'un driver (par user_id)
   */
  async updateLocation(user_id, lat, lng) {
    const query = `
      UPDATE drivers
      SET latitude = $2, longitude = $3, updated_at = NOW()
      WHERE user_id = $1
      RETURNING id, user_id, latitude, longitude, is_available, updated_at
    `;
    const result = await db.query(query, [user_id, lat, lng]);
    return result.rows[0] || null;
  },

  /**
   * Mettre à jour la disponibilité d'un driver (par user_id)
   */
  async updateAvailability(user_id, is_available) {
    const query = `
      UPDATE drivers
      SET is_available = $2, updated_at = NOW()
      WHERE user_id = $1
      RETURNING id, user_id, is_available, updated_at
    `;
    const result = await db.query(query, [user_id, is_available]);
    return result.rows[0] || null;
  },

  /**
   * Trouver les drivers disponibles à proximité
   * Utilise la formule Haversine côté application
   */
  async findNearby({ lat, lng, radius = 20 }) {
    const query = `
      SELECT d.*,
             u.full_name,
             u.phone,
             u.email
      FROM drivers d
      JOIN users u ON u.id = d.user_id
      WHERE d.is_available = true
        AND d.latitude IS NOT NULL
        AND d.longitude IS NOT NULL
        AND u.is_active = true
    `;
    const result = await db.query(query);

    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;

    return result.rows
      .map((row) => {
        const lat2 = parseFloat(row.latitude);
        const lng2 = parseFloat(row.longitude);
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
   * Trouver le profil driver par user_id
   */
  async findByUserId(user_id) {
    const query = `
      SELECT d.*, u.full_name, u.phone, u.email
      FROM drivers d
      JOIN users u ON u.id = d.user_id
      WHERE d.user_id = $1
    `;
    const result = await db.query(query, [user_id]);
    return result.rows[0] || null;
  },
};

module.exports = DriverModel;
