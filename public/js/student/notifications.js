import { getNotifications, markNotificationRead as apiMarkNotificationRead, deleteNotification as apiDeleteNotification, markAllNotificationsRead as apiMarkAllNotificationsRead } from './api.js';

export async function loadNotifications(ctx) {
  try {
    const data = await getNotifications();
    if (data && data.success) {
      const filtered = (data.notifications || []).filter(n => n.type !== 'message');
      ctx.notifications = filtered;
      const unreadFiltered = filtered.filter(n => !n.is_read).length;
      const notifBadge = document.getElementById('notificationBadge');
      if (notifBadge) { notifBadge.textContent = String(unreadFiltered); notifBadge.style.display = unreadFiltered > 0 ? 'flex' : 'none'; }
      const markAllBtn = document.getElementById('markAllRead');
      if (markAllBtn) markAllBtn.style.display = unreadFiltered > 0 ? 'inline-block' : 'none';
      if (document.getElementById('notificationsModal')?.style.display === 'flex') renderNotifications(ctx, filtered);
    }
  } catch {}
}

export function renderNotifications(ctx, notifications) {
  const container = document.getElementById('notificationsList');
  if (!container) return;
  if (!notifications || notifications.length === 0) { container.innerHTML = '<div class="empty-state">No notifications</div>'; return; }
  container.innerHTML = notifications.map(notif => `
            <div class="message-item ${notif.is_read ? '' : 'unread'}" data-notification-id="${notif.id}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong>${notif.title}</strong>${notif.is_read ? '' : '<span class="red-dot"></span>'}
                    </div>
                    <small>${new Date(notif.created_at).toLocaleString()}</small>
                </div>
                <div class="message-content">${notif.message}</div>
                <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end;">
                    ${notif.is_read ? '' : '<button class="btn btn-outline btn-small mark-read-btn"><i class="fas fa-check"></i> Mark as Read</button>'}
                    <button class="btn btn-danger btn-small delete-notif-btn">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
  container.querySelectorAll('.mark-read-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const notificationId = btn.closest('.message-item')?.getAttribute('data-notification-id');
      if (!notificationId) return;
      await markNotificationRead(ctx, notificationId);
    });
  });
  container.querySelectorAll('.delete-notif-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const notificationId = btn.closest('.message-item')?.getAttribute('data-notification-id');
      if (!notificationId) return;
      if (!confirm('Delete this notification?')) return;
      try { const data = await apiDeleteNotification(notificationId); if (data && data.success) await loadNotifications(ctx); }
      catch {}
    });
  });
}

export async function showNotificationsModal(ctx) {
  const modal = document.getElementById('notificationsModal');
  try { await loadNotifications(ctx); } catch {}
  renderNotifications(ctx, ctx.notifications);
  if (modal) modal.style.display = 'flex';
}

export function hideNotificationsModal() { const m = document.getElementById('notificationsModal'); if (m) m.style.display = 'none'; }

export async function markNotificationRead(ctx, notificationId) {
  try { await apiMarkNotificationRead(notificationId); await loadNotifications(ctx); }
  catch {}
}

export async function markAllNotificationsRead(ctx) {
  try { await apiMarkAllNotificationsRead(); await loadNotifications(ctx); }
  catch {}
}

