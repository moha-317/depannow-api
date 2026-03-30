const db = require('../config/db');

const NotificationModel = {
  /**
   * Créer une notification
   */
  async create({ id, user_id, title, message, type }) {
    const query = `
      INSERT INTO notifications (id, user_id, title, message, type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await db.query(query, [id, user_id, title, message, type]);
    return result.rows[0];
  },

  /**
   * Récupérer toutes les notifications d'un utilisateur (les plus récentes en premier)
   */
  async findByUserId(user_id) {
    const query = `
      SELECT id, user_id, title, message, type, is_read, created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [user_id]);
    return result.rows;
  },

  /**
   * Trouver une notification par ID et user_id (sécurité : l'utilisateur ne peut lire que les siennes)
   */
  async findByIdAndUserId(id, user_id) {
    const query = `
      SELECT * FROM notifications
      WHERE id = $1 AND user_id = $2
    `;
    const result = await db.query(query, [id, user_id]);
    return result.rows[0] || null;
  },

  /**
   * Marquer une notification comme lue
   */
  async markAsRead(id, user_id) {
    const query = `
      UPDATE notifications
      SET is_read = true
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [id, user_id]);
    return result.rows[0] || null;
  },

  /**
   * Compter les notifications non lues d'un utilisateur
   */
  async countUnread(user_id) {
    const query = `
      SELECT COUNT(*) AS unread_count
      FROM notifications
      WHERE user_id = $1 AND is_read = false
    `;
    const result = await db.query(query, [user_id]);
    return parseInt(result.rows[0].unread_count, 10);
  },
};

module.exports = NotificationModel;
