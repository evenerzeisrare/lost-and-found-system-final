import { fetchJson, updateBadge, el } from './admin-ui.js';

export async function loadNotifications(ctx) {
  try {
    const data = await fetchJson('/api/notifications', { credentials: 'include' });
    if (data.success) {
      updateBadge('notificationBadge', data.unreadCount || 0);
      if (typeof ctx._lastUnreadCount === 'number' && data.unreadCount > ctx._lastUnreadCount) {
        const latest = data.notifications && data.notifications.length ? data.notifications[0] : null;
        const title = latest?.title || 'New Notification';
        const msg = latest?.message || '';
        ctx.showNotification(`${title}${msg ? ': ' + msg : ''}`, 'info');
      }
      ctx._lastUnreadCount = data.unreadCount || 0;
      if (el('notificationsModal')?.style.display === 'flex') {
        ctx.renderNotifications(data.notifications || []);
      }
    }
  } catch (e) {}
}

export function startNotificationPolling(ctx) {
  ctx._lastUnreadCount = undefined;
  loadNotifications(ctx);
  if (ctx._notifInterval) clearInterval(ctx._notifInterval);
  ctx._notifInterval = setInterval(() => loadNotifications(ctx), 5000);
}

export function showNotificationsModal(ctx) {
  const modal = el('notificationsModal');
  (async () => {
    try { await loadNotifications(ctx); } catch {}
    const list = el('notificationsList');
    if (list && !list.innerHTML) list.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading notifications...</div>';
    modal.style.display = 'flex';
  })();
}

export function hideNotificationsModal() {
  const modal = el('notificationsModal');
  if (modal) modal.style.display = 'none';
}
