const db = require('../config/db');

const UserModel = {
  /**
   * Créer un nouvel utilisateur
   */
  async create({ id, full_name, email, phone, password_hash, role }) {
    const query = `
      INSERT INTO users (id, full_name, email, phone, password_hash, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, full_name, email, phone, role, is_active, created_at
    `;
    const values = [id, full_name, email, phone, password_hash, role];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  /**
   * Trouver un utilisateur par email
   */
  async findByEmail(email) {
    const query = `SELECT * FROM users WHERE email = $1 AND is_active = true`;
    const result = await db.query(query, [email]);
    return result.rows[0] || null;
  },

  /**
   * Trouver un utilisateur par ID
   */
  async findById(id) {
    const query = `
      SELECT id, full_name, email, phone, role, is_active, created_at, updated_at
      FROM users
      WHERE id = $1 AND is_active = true
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  },

  /**
   * Vérifier si un email existe déjà
   */
  async emailExists(email) {
    const query = `SELECT id FROM users WHERE email = $1`;
    const result = await db.query(query, [email]);
    return result.rows.length > 0;
  },

  /**
   * Mettre à jour le timestamp updated_at
   */
  async updateTimestamp(id) {
    const query = `UPDATE users SET updated_at = NOW() WHERE id = $1`;
    await db.query(query, [id]);
  },
};

module.exports = UserModel;
