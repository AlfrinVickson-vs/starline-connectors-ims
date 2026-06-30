const { query } = require('../config/db');

const stageHistoryModel = {
  /**
   * Record a stage transition
   */
  async create({ item_id, from_stage, to_stage, status, comments, changed_by }) {
    const { rows } = await query(
      `INSERT INTO stage_history (item_id, from_stage, to_stage, status, comments, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [item_id, from_stage, to_stage, status, comments, changed_by]
    );
    return rows[0];
  },

  /**
   * Full history for an item
   */
  async findByItemId(item_id) {
    const { rows } = await query(
      `SELECT sh.*, u.name AS changed_by_name, u.role AS changed_by_role
       FROM stage_history sh
       JOIN users u ON u.id = sh.changed_by
       WHERE sh.item_id = $1
       ORDER BY sh.changed_at ASC`,
      [item_id]
    );
    return rows;
  },

  /**
   * Average time (in hours) spent at each stage (for reports)
   */
  async avgTimePerStage() {
    const { rows } = await query(
      `WITH stage_durations AS (
         SELECT
           item_id,
           from_stage AS stage,
           changed_at,
           LEAD(changed_at) OVER (PARTITION BY item_id ORDER BY changed_at) AS next_changed_at
         FROM stage_history
       )
       SELECT
         stage,
         AVG(EXTRACT(EPOCH FROM (next_changed_at - changed_at)) / 3600) AS avg_hours
       FROM stage_durations
       WHERE stage IS NOT NULL AND next_changed_at IS NOT NULL
       GROUP BY stage`
    );
    return rows;
  },

  /**
   * Rejection rate per stage (rejections / total transitions into that stage)
   */
  async rejectionRatePerStage() {
    const { rows } = await query(
      `SELECT
         to_stage AS stage,
         COUNT(*) FILTER (WHERE status = 'rejected') AS rejections,
         COUNT(*) AS total,
         ROUND(
           100.0 * COUNT(*) FILTER (WHERE status = 'rejected') / NULLIF(COUNT(*), 0),
           2
         ) AS rejection_rate_pct
       FROM stage_history
       GROUP BY to_stage`
    );
    return rows;
  },
};

module.exports = stageHistoryModel;
