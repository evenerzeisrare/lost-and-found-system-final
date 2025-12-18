import { fetchJson, el } from './admin-ui.js';

export async function checkAuth(ctx) {
  try {
    const response = await fetch('/api/user');
    if (!response.ok) { window.location.href = '/login.html'; return; }
    const data = await response.json();
    ctx.currentUser = data.user;
    if (!ctx.currentUser) { window.location.href = '/login.html'; return; }
    if (ctx.currentUser.role !== 'admin') { window.location.href = '/student-dashboard.html'; return; }
    updateUserInfo(ctx);
  } catch (error) {
    window.location.href = '/login.html';
  }
}

export function updateUserInfo(ctx) {
  if (!ctx.currentUser) return;
  const adminNameEl = el('adminName');
  const adminAvatarEl = el('adminAvatar');
  if (adminNameEl) adminNameEl.textContent = ctx.currentUser.full_name || 'Admin';
  if (adminAvatarEl) {
    if (ctx.currentUser.full_name) adminAvatarEl.textContent = ctx.currentUser.full_name.charAt(0).toUpperCase();
    if (ctx.currentUser.avatar_url) {
      adminAvatarEl.style.backgroundImage = `url('${ctx.currentUser.avatar_url}')`;
      adminAvatarEl.style.backgroundSize = 'cover';
      adminAvatarEl.style.backgroundPosition = 'center';
    } else {
      adminAvatarEl.style.backgroundColor = '#2E7D32';
      adminAvatarEl.style.color = 'white';
      adminAvatarEl.style.display = 'flex';
      adminAvatarEl.style.alignItems = 'center';
      adminAvatarEl.style.justifyContent = 'center';
      adminAvatarEl.style.fontWeight = 'bold';
    }
  }
}

export async function logout() {
  try {
    const response = await fetch('/api/logout');
    const data = await response.json();
    if (data.success) { window.location.href = '/login.html'; } else { alert('Logout failed'); }
  } catch (error) { window.location.href = '/login.html'; }
}
