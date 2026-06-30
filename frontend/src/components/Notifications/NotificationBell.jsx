import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Package } from 'lucide-react';
import { notificationsAPI } from '../../api/apiService';
import { formatDistanceToNow } from 'date-fns';

const NotificationBell = () => {
  const [open,    setOpen]    = useState(false);
  const [data,    setData]    = useState({ notifications: [], unread_count: 0 });
  const [loading, setLoading] = useState(false);
  const dropRef = useRef(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data: res } = await notificationsAPI.list({ limit: 20 });
      setData(res);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAll = async () => {
    await notificationsAPI.markAllRead();
    setData((prev) => ({
      ...prev,
      unread_count: 0,
      notifications: prev.notifications.map((n) => ({ ...n, is_read: true })),
    }));
  };

  const markOne = async (id) => {
    await notificationsAPI.markRead([id]);
    setData((prev) => ({
      ...prev,
      unread_count: Math.max(0, prev.unread_count - 1),
      notifications: prev.notifications.map((n) => n.id === id ? { ...n, is_read: true } : n),
    }));
  };

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) fetch(); }}
        className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all duration-200"
        id="notification-bell-btn"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {data.unread_count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1 animate-pulse-slow">
            {data.unread_count > 99 ? '99+' : data.unread_count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl z-50 animate-slide-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-brand-400" />
              <span className="text-sm font-semibold text-slate-200">Notifications</span>
              {data.unread_count > 0 && (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-semibold">
                  {data.unread_count} new
                </span>
              )}
            </div>
            {data.unread_count > 0 && (
              <button
                onClick={markAll}
                className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/40">
            {loading && data.notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">Loading…</div>
            ) : data.notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <Bell size={28} className="mx-auto mb-2 opacity-30" />
                No notifications
              </div>
            ) : (
              data.notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors cursor-pointer ${!n.is_read ? 'bg-brand-500/5' : ''}`}
                  onClick={() => !n.is_read && markOne(n.id)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${!n.is_read ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-slate-500'}`}>
                    <Package size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${!n.is_read ? 'text-slate-200' : 'text-slate-400'}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
