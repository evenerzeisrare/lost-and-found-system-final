import { checkAuth, updateUserInfo, logout } from './auth.js';
import { loadDashboardData } from './ui.js';
import { loadBrowseItems, loadMyItems, filterBrowseItems, fetchItemById, showReportModal, hideReportModal, submitReport, showItemDetail, hideItemDetailModal, showClaimProofModal, hideClaimProofModal, submitClaimProof, updateItemStatus, showEditItemModal, hideEditItemModal, submitEditItem, deleteItem } from './items.js';
import { loadMessages, renderMessages, showMessageModal, hideMessageModal, sendMessage, deleteAllMessages, showChatModal, hideChatModal, loadConversation, renderConversation, sendChatMessage, showSendMessageModal, showNewMessageModal } from './messages.js';
import { loadNotifications, renderNotifications, showNotificationsModal, hideNotificationsModal, markNotificationRead, markAllNotificationsRead } from './notifications.js';
import { updateProfile } from './profile.js';

const ctx = { currentUser: null, currentItems: [], notifications: [], messages: [], announcements: [], browseItems: [], _msgInterval: null, _lastUnreadMessages: undefined, _chatInterval: null, actions: {}, handlers: {} };

function showPage(page) {
  document.querySelectorAll('.page-content').forEach(p => { p.classList.remove('active'); });
  const pageElement = document.getElementById(`${page}Page`);
  if (pageElement) {
    pageElement.classList.add('active');
    switch(page) {
      case 'dashboard': ctx.handlers.loadDashboardData(ctx); break;
      case 'browse': loadBrowseItems(ctx); break;
      case 'my-items': loadMyItems(ctx, 'all'); break;
      case 'messages': loadMessages(ctx); break;
<<<<<<< HEAD
      case 'announcements': (async () => { const { loadAllAnnouncements } = await import('./ui.js'); await loadAllAnnouncements(ctx); })(); break;
=======
      case 'announcements': (async () => { const data = await (await fetch('/api/announcements', { credentials: 'include' })).json(); if (data && data.success) { const list = document.getElementById('allAnnouncementsList'); if (list) list.innerHTML = ''; } })(); break;
>>>>>>> 2574b52f13985695c0aba54d0b86fa1a207b1c5d
      case 'profile': break;
    }
  }
}

function initEventListeners() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      showPage(page);
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      if (window.innerWidth <= 768) document.getElementById('navLinks')?.classList.remove('active');
    });
  });
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(content => { content.classList.remove('active'); });
      document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`)?.classList.add('active');
      if (tabName === 'all') loadMyItems(ctx, 'all'); else if (tabName === 'claimed') loadMyItems(ctx, 'claimed');
    });
  });
  document.getElementById('reportLostBtn')?.addEventListener('click', () => showReportModal(ctx, 'lost'));
  document.getElementById('reportFoundBtn')?.addEventListener('click', () => showReportModal(ctx, 'found'));
  document.getElementById('myReportLostBtn')?.addEventListener('click', () => showReportModal(ctx, 'lost'));
  document.getElementById('myReportFoundBtn')?.addEventListener('click', () => showReportModal(ctx, 'found'));
  document.getElementById('cancelReport')?.addEventListener('click', () => hideReportModal());
  document.getElementById('submitReport')?.addEventListener('click', () => submitReport(ctx));
  document.querySelectorAll('.close').forEach(btn => { btn.addEventListener('click', () => { hideReportModal(); hideItemDetailModal(); hideMessageModal(); hideNotificationsModal(); hideEditItemModal(); hideChatModal(ctx); hideClaimProofModal(); }); });
  document.getElementById('logoutBtn')?.addEventListener('click', () => logout());
  document.getElementById('notificationBell')?.addEventListener('click', () => showNotificationsModal(ctx));
  document.getElementById('markAllRead')?.addEventListener('click', () => markAllNotificationsRead(ctx));
  document.getElementById('profileForm')?.addEventListener('submit', (e) => { e.preventDefault(); updateProfile(ctx); });
  document.getElementById('searchInput')?.addEventListener('input', () => { filterBrowseItems(ctx); });
  document.getElementById('categoryFilter')?.addEventListener('change', () => { filterBrowseItems(ctx); });
  document.getElementById('statusFilter')?.addEventListener('change', () => { filterBrowseItems(ctx); });
  document.getElementById('itemImage')?.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => { const p = document.getElementById('imagePreview'); const img = document.getElementById('previewImage'); if (p) p.style.display = 'block'; if (img) img.src = ev.target.result; }; reader.readAsDataURL(file); } });
  document.getElementById('profileImage')?.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => { const img = document.getElementById('profileAvatarImg'); const avatar = document.getElementById('profileAvatar'); if (img) { img.src = ev.target.result; img.style.display = 'block'; } if (avatar) avatar.style.display = 'none'; }; reader.readAsDataURL(file); } });
  document.getElementById('profileCameraBtn')?.addEventListener('click', () => { if (!ctx.profileEditing) return; document.getElementById('profileImage')?.click(); });
  document.getElementById('editProfileBtn')?.addEventListener('click', async () => {
    const phone = document.getElementById('phoneNumber');
    const college = document.getElementById('collegeSelect');
    const program = document.getElementById('programInput');
    const cameraBtn = document.getElementById('profileCameraBtn');
    const btn = document.getElementById('editProfileBtn');
    if (!ctx.profileEditing) {
      ctx.profileEditing = true;
      if (phone) phone.disabled = false;
      if (college) college.disabled = false;
      if (program) program.disabled = false;
      if (cameraBtn) cameraBtn.style.display = 'block';
      if (btn) btn.innerHTML = '<i class="fas fa-save"></i> Save Profile';
    } else {
      await updateProfile(ctx);
      ctx.profileEditing = false;
      if (phone) phone.disabled = true;
      if (college) college.disabled = true;
      if (program) program.disabled = true;
      if (cameraBtn) cameraBtn.style.display = 'none';
      if (btn) btn.innerHTML = 'Edit Profile';
    }
  });
  document.getElementById('deleteAllMessagesBtn')?.addEventListener('click', () => { deleteAllMessages(ctx); });
  document.getElementById('sendMessage')?.addEventListener('click', () => { sendMessage(ctx); });
  document.getElementById('cancelMessage')?.addEventListener('click', () => { hideMessageModal(); });
  document.getElementById('sendMessageBtn')?.addEventListener('click', () => { showSendMessageModal(ctx); });
  document.getElementById('submitClaimProofBtn')?.addEventListener('click', () => { showClaimProofModal(); });
<<<<<<< HEAD
  const viewAllBtn = document.querySelector('#dashboardPage a[data-page="browse"]');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showPage('browse');
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      document.querySelector('.nav-link[data-page="browse"]')?.classList.add('active');
    });
  }
=======
>>>>>>> 2574b52f13985695c0aba54d0b86fa1a207b1c5d
}

function initActions() {
  ctx.actions = { showItemDetail, showMessageModal, showEditItemModal, deleteItem, fetchItemById, showChatModal };
  ctx.handlers = { loadDashboardData };
}

async function init() {
  initActions();
  await checkAuth(ctx);
  initEventListeners();
  await loadDashboardData(ctx);
  showPage('dashboard');
  setInterval(() => loadNotifications(ctx), 30000);
  await loadMessages(ctx);
  if (ctx._msgInterval) clearInterval(ctx._msgInterval);
  ctx._msgInterval = setInterval(() => loadMessages(ctx), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  window.__dashboardInstance = { submitEditItem: () => submitEditItem(ctx), sendChatMessage: () => sendChatMessage(ctx), submitClaimProof: () => submitClaimProof(ctx) };
});
<<<<<<< HEAD
=======

>>>>>>> 2574b52f13985695c0aba54d0b86fa1a207b1c5d
