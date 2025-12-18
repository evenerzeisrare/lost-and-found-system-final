import { fetchJson } from './admin-ui.js';

export async function loadDashboardData(ctx) {
  try {
    const response = await fetch('/api/admin/dashboard-data');
    if (response.status === 401) { window.location.href = '/login.html'; return; }
    if (response.status === 403) { window.location.href = '/student-dashboard.html'; return; }
    const data = await response.json();
    if (data.success) {
      ctx.updateStats(data.stats);
      ctx.recentReports = data.recentReports || [];
      ctx.renderRecentActivity(ctx.recentReports);
    }
  } catch (error) {}
}

export async function loadAllData(ctx) {
  await Promise.all([
    ctx.loadAllReports(),
    ctx.loadUsers(),
    ctx.loadReportedMessages(),
    ctx.loadAnnouncements()
  ]);
}

export async function loadAllReports(ctx) {
  try {
    const res = await fetch('/api/admin/items');
    const data = await res.json();
    if (data.success) { ctx.allReports = data.items || []; ctx.renderItemsTable(); }
  } catch (e) {}
}

export async function loadReportedMessages(ctx) {
  try {
    const response = await fetch('/api/admin/reported-messages');
    const data = await response.json();
    if (data.success) { ctx.reportedMessages = data.messages || []; ctx.renderReportedMessages(); }
  } catch (error) {}
}

export async function loadAnnouncements(ctx) {
  try {
    const res = await fetch('/api/admin/all-announcements');
    const data = await res.json();
    if (data.success) { ctx.announcements = data.announcements || []; ctx.renderAnnouncements(); }
  } catch (e) {}
}

export async function loadUsers(ctx) {
  try {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (data.success) { ctx.users = data.users || []; ctx.renderUsersTable(); }
  } catch (e) {}
}
