const notificationModel = require('../models/notificationModel');

// GET /api/notifications
const listNotifications = async (req, res) => {
  const { unread_only = 'false', limit = 50 } = req.query;
  const notifications = await notificationModel.findForUser(req.user.id, {
    unread_only: unread_only === 'true',
    limit:       parseInt(limit, 10),
  });
  const unread_count = await notificationModel.countUnread(req.user.id);
  return res.json({ success: true, notifications, unread_count });
};

// PATCH /api/notifications/read
const markRead = async (req, res) => {
  const { ids } = req.body; // array of notification IDs
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ success: false, message: 'ids must be an array' });
  }
  const updated = await notificationModel.markRead(ids, req.user.id);
  return res.json({ success: true, updated });
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
  await notificationModel.markAllRead(req.user.id);
  return res.json({ success: true, message: 'All notifications marked as read' });
};

module.exports = { listNotifications, markRead, markAllRead };
