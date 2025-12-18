import { el } from './admin-ui.js';

export function initEventListeners(ctx) {
  el('refreshData')?.addEventListener('click', async () => { await ctx.loadDashboardData(); await ctx.loadAllData(); ctx.showNotification('Data refreshed successfully', 'success'); });
  el('logoutBtn')?.addEventListener('click', async () => { await ctx.logout(); });
  document.querySelectorAll('.nav-link').forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); const tab = link.getAttribute('data-tab'); ctx.switchTab(tab); }); });
<<<<<<< HEAD
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const tab = link.getAttribute('data-tab');
      ctx.switchTab(tab);
      if (tab === 'announcements') { await ctx.loadAnnouncements(); }
      if (tab === 'messages') { await ctx.loadReportedMessages(); }
      if (tab === 'items') { await ctx.loadAllReports(); }
      if (tab === 'users') { await ctx.loadUsers(); }
    });
  });
=======
>>>>>>> 2574b52f13985695c0aba54d0b86fa1a207b1c5d
  document.querySelectorAll('.action-card').forEach(card => { card.addEventListener('click', () => { const action = card.getAttribute('data-action'); ctx.handleQuickAction(action); }); });
  el('applyItemFilters')?.addEventListener('click', () => { ctx.filterItems(); });
  el('itemSearch')?.addEventListener('input', () => { ctx.debouncedFilterItems(); });
  el('itemStatusFilter')?.addEventListener('change', () => { ctx.filterItems(); });
  el('itemCategoryFilter')?.addEventListener('change', () => { ctx.filterItems(); });
  el('userSearch')?.addEventListener('input', () => { ctx.debouncedFilterUsers(); });
  document.querySelectorAll('.close').forEach(btn => { btn.addEventListener('click', function() { const modal = this.closest('.modal'); if (modal) modal.style.display = 'none'; }); });
  document.querySelectorAll('.modal').forEach(modal => { modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; }); });
  el('submitEditAnnouncement')?.addEventListener('click', async () => { await ctx.submitEditAnnouncement(); });
  el('cancelEditAnnouncement')?.addEventListener('click', () => { el('editAnnouncementModal').style.display = 'none'; });
  el('deleteMessageBtn')?.addEventListener('click', async () => { const id = el('messageDetailModal').dataset.messageId; if (id) await ctx.deleteMessage(id); });
  el('closeItemModal')?.addEventListener('click', () => { el('itemDetailModal').style.display = 'none'; });
  el('createAnnouncementBtn')?.addEventListener('click', () => { ctx.showAnnouncementForm(); });
  el('cancelAnnouncement')?.addEventListener('click', () => { ctx.hideAnnouncementForm(); });
  document.getElementById('newAnnouncementForm')?.addEventListener('submit', async (e) => { e.preventDefault(); await ctx.createAnnouncement(); });
  el('toggleUserStatusBtn')?.addEventListener('click', async () => { const userId = el('userDetailModal').dataset.userId; if (userId) await ctx.toggleUserStatus(userId); });
  el('notificationBell')?.addEventListener('click', () => { ctx.showNotificationsModal(); });
  el('markAllRead')?.addEventListener('click', async () => { await ctx.markAllNotificationsRead(); });
}
