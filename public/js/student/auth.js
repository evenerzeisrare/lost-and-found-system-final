import { fetchJson, el } from '../utils/helpers.js';

export async function checkAuth(ctx) {
  try {
    const response = await fetch('/api/user', { credentials: 'include' });
    if (!response.ok) throw new Error('Not authenticated');
    const data = await response.json();
    ctx.currentUser = data.user;
    if (!ctx.currentUser) { window.location.href = '/login.html'; return; }
    if (!ctx.currentUser.is_active) { alert('Your account has been deactivated. Please contact administrator.'); await logout(); return; }
    updateUserInfo(ctx);
  } catch (error) { window.location.href = '/login.html'; }
}

export function updateUserInfo(ctx) {
  if (!ctx.currentUser) return;
  const userNameEl = el('userName'); if (userNameEl) userNameEl.textContent = ctx.currentUser.full_name;
  const profileName = el('profileName'); if (profileName) profileName.textContent = ctx.currentUser.full_name;
  const profileEmail = el('profileEmail'); if (profileEmail) profileEmail.textContent = ctx.currentUser.email;
  const emailInput = el('profileEmailInput'); if (emailInput) emailInput.value = ctx.currentUser.email;
  const sidLabel = el('profileStudentId'); if (sidLabel) sidLabel.textContent = `Student ID: ${ctx.currentUser.student_id || 'Not set'}`;
  const avatar = el('profileAvatar'); const avatarImg = el('profileAvatarImg');
  if (ctx.currentUser.avatar_url && avatarImg) { avatarImg.src = ctx.currentUser.avatar_url; avatarImg.style.display = 'block'; if (avatar) avatar.style.display = 'none'; }
  else { if (avatar) { avatar.style.display = 'flex'; avatar.textContent = ctx.currentUser.full_name?.charAt(0)?.toUpperCase() || 'S'; } if (avatarImg) avatarImg.style.display = 'none'; }
  const phone = el('phoneNumber'); if (ctx.currentUser.phone_number && phone) phone.value = ctx.currentUser.phone_number;
  const contact = el('contactMethod'); if (ctx.currentUser.contact_method && contact) contact.value = ctx.currentUser.contact_method;
  const studentIdInput = el('studentId'); if (ctx.currentUser.student_id && studentIdInput) studentIdInput.value = ctx.currentUser.student_id;
}

export async function logout() {
  try { const response = await fetch('/api/logout', { credentials: 'include' }); const data = await response.json(); if (data.success) { window.location.href = '/login.html'; } else { alert('Logout failed'); } }
  catch { window.location.href = '/login.html'; }
}
