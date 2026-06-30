const { query } = require('../config/db');

const notificationModel = {
  /**
   * Create notifications for a list of user IDs
   */
  async createBulk({ userIds, message, related_item_id, notification_type = 'stage_change' }) {
    if (!userIds || userIds.length === 0) return [];
    const insertPromises = userIds.map((uid) =>
      query(
        `INSERT INTO notifications (user_id, message, related_item_id, notification_type)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [uid, message, related_item_id, notification_type]
      )
    );
    const results = await Promise.all(insertPromises);
    return results.map((r) => r.rows[0]);
  },

  /**
   * List notifications for a user (newest first), with optional unread filter
   */
  async findForUser(user_id, { unread_only = false, limit = 50 } = {}) {
    const cond = unread_only ? 'AND is_read = FALSE' : '';
    const { rows } = await query(
      `SELECT n.*, i.item_name AS related_item_name
       FROM notifications n
       LEFT JOIN inventory_items i ON i.id = n.related_item_id
       WHERE n.user_id = $1 ${cond}
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [user_id, limit]
    );
    return rows;
  },

  /**
   * Count unread notifications for a user
   */
  async countUnread(user_id) {
    const { rows } = await query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [user_id]
    );
    return parseInt(rows[0].count, 10);
  },

  /**
   * Mark specific notification(s) as read
   */
  async markRead(ids, user_id) {
    const { rows } = await query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = ANY($1::int[]) AND user_id = $2
       RETURNING *`,
      [ids, user_id]
    );
    return rows;
  },

  /**
   * Mark ALL notifications for a user as read
   */
  async markAllRead(user_id) {
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
      [user_id]
    );
  },
};

module.exports = notificationModel;
