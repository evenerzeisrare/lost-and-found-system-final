import * as UI from './admin-ui.js';
import * as Auth from './admin-auth.js';
import * as Data from './admin-data.js';
import * as Events from './admin-events.js';
import * as Notifs from './admin-notifications.js';

class AdminDashboard {
  constructor() {
    this.currentUser = null;
    this.reports = [];
    this.users = [];
    this.reportedMessages = [];
    this.announcements = [];
    this.allReports = [];
    this.currentItemPage = 1;
    this.itemsPerPage = 10;
    this._debounceMap = {};
    this._notifInterval = null;
    this._lastUnreadCount = undefined;
  }

  async init() {
    await Auth.checkAuth(this);
    Events.initEventListeners(this);
    await Data.loadDashboardData(this);
    await Data.loadAllData(this);
    Notifs.startNotificationPolling(this);
    setInterval(() => Data.loadDashboardData(this), 30000);
  }

  showNotification(msg, type) { UI.showNotification(msg, type); }
  _openModal(id) { UI.openModal(id); }
  _closeModal(id) { UI.closeModal(id); }
  _clearInput(id) { UI.clearInput(id); }
  _el(id) { return UI.el(id); }
  _qsa(sel) { return UI.qsa(sel); }
  _updateBadge(id, v) { UI.updateBadge(id, v); }
  _buildFormData(fields, fileField, fileInput) { return UI.buildFormData(fields, fileField, fileInput); }
  async _postForm(url, fd) { return UI.postForm(url, fd); }
  async _fetchJson(url, options) { return UI.fetchJson(url, options); }

  debouncedFilterItems() { this._debounce('items', () => this.filterItems(), 300); }
  debouncedFilterUsers() { this._debounce('users', () => this.filterUsers(), 300); }
  _debounce(key, fn, wait) { if (this._debounceMap[key]) clearTimeout(this._debounceMap[key]); this._debounceMap[key] = setTimeout(fn, wait); }

  // The following methods are placeholders expecting existing implementations in the original class.
  // They keep names so HTML bindings continue to work. You can progressively move their bodies here or to modules.
  updateStats(stats) {
    this._el('pendingCount').textContent = stats?.pending_verification || 0;
    this._el('readyCount').textContent = stats?.ready_for_claim || 0;
    this._el('claimedCount').textContent = stats?.claimed_this_month || 0;
    this._el('unresolvedCount').textContent = stats?.unresolved_reports || 0;
    this._el('reportedCount').textContent = stats?.reported_messages || 0;
    this._el('inactiveCount').textContent = stats?.inactive_users || 0;
    this._el('pendingTrend').textContent = '+12%';
    this._el('readyTrend').textContent = '+8%';
    this._el('claimedTrend').textContent = '+15%';
    this._el('unresolvedTrend').textContent = '-5%';
    this._el('reportedTrend').textContent = '+3%';
    this._el('inactiveTrend').textContent = '+2%';
  }
  renderRecentActivity(reports) {
    const container = this._el('recentActivity');
    if (!container) return;
    if (!reports || reports.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">No recent activity</p>';
      return;
    }
    const activities = (reports || []).slice(0, 5).map(report => {
      const date = new Date(report.created_at).toLocaleString();
      const statusBadge = this.getStatusBadge(report);
      return `
        <div style="padding: 10px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${report.item_name}</strong>
            <div style="font-size: 0.85rem; color: #666;">
              ${report.full_name || 'Unknown user'} • ${date}
            </div>
          </div>
          ${statusBadge}
        </div>
      `;
    }).join('');
    container.innerHTML = activities;
  }
  getStatusBadge(obj) {
    let className = 'status-pending';
    let text = 'Pending';
    if (obj.status === 'claimed') { className = 'status-claimed'; text = 'Claimed'; }
    else if (obj.status === 'found') { className = obj.claimed_by ? 'status-claimed' : 'status-ready'; text = obj.claimed_by ? 'Claimed' : 'Ready'; }
    else if (obj.status === 'lost') { className = 'status-lost'; text = 'Lost'; }
    else if (obj.status === 'returned') { className = 'status-returned'; text = 'Returned'; }
    return `<span class="user-status ${className}">${text}</span>`;
  }
  renderItemsTable() {
    const tbody = this._el('itemsTableBody');
    if (!tbody || !this.allReports) return;
    const filteredItems = this.filterItemsArray();
    const startIndex = (this.currentItemPage - 1) * this.itemsPerPage;
    const paginatedItems = filteredItems.slice(startIndex, startIndex + this.itemsPerPage);
    if (paginatedItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
            <i class="fas fa-box-open" style="font-size: 2rem; margin-bottom: 10px; display: block; color: #ccc;"></i>
            No items found
          </td>
        </tr>
      `;
      this.updateItemsPagination(0);
      return;
    }
    tbody.innerHTML = paginatedItems.map(item => this.createItemRow(item)).join('');
    this.updateItemsPagination(filteredItems.length);
    this._qsa('.view-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.itemId;
        this.showItemDetails(itemId);
      });
    });
  }
  createItemRow(item) {
    const date = new Date(item.created_at).toLocaleDateString();
    const statusBadge = this.getStatusBadge(item);
    return `
      <tr>
        <td>${item.student_id || 'N/A'}</td>
        <td><strong>${item.item_name}</strong></td>
        <td>${item.category || 'Uncategorized'}</td>
        <td>${statusBadge}</td>
        <td>${item.full_name || 'Unknown'}</td>
        <td>${date}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon view view-item-btn" data-item-id="${item.id}" title="View Details">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn-icon" onclick="adminDashboard.showAdminEditItemModal(${item.id})" title="Edit Item">
              <i class="fas fa-edit"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }
  filterItemsArray() {
    let filtered = [...(this.allReports || [])];
    const searchTerm = (this._el('itemSearch')?.value || '').toLowerCase();
    const statusFilter = this._el('itemStatusFilter')?.value || 'all';
    const categoryFilter = this._el('itemCategoryFilter')?.value || 'all';
    if (searchTerm) {
      filtered = filtered.filter(item =>
        (item.item_name || '').toLowerCase().includes(searchTerm) ||
        (item.full_name || '').toLowerCase().includes(searchTerm) ||
        (item.category || '').toLowerCase().includes(searchTerm) ||
        (item.description || '').toLowerCase().includes(searchTerm)
      );
    }
    if (statusFilter !== 'all') filtered = filtered.filter(item => item.status === statusFilter);
    if (categoryFilter !== 'all') filtered = filtered.filter(item => item.category === categoryFilter);
    return filtered;
  }
  filterItems() { this.currentItemPage = 1; this.renderItemsTable(); }
  updateItemsPagination(totalItems) {
    const paginationEl = this._el('itemsPagination');
    if (!paginationEl) return;
    const totalPages = Math.ceil((totalItems || 0) / this.itemsPerPage);
    if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }
    let html = '';
    if (this.currentItemPage > 1) {
      html += `
        <button class="page-btn" onclick="adminDashboard.changeItemPage(${this.currentItemPage - 1})">
          <i class="fas fa-chevron-left"></i>
        </button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      if (i === this.currentItemPage) html += `<button class="page-btn active">${i}</button>`;
      else if (i === 1 || i === totalPages || (i >= this.currentItemPage - 1 && i <= this.currentItemPage + 1)) html += `<button class=\"page-btn\" onclick=\"adminDashboard.changeItemPage(${i})\">${i}</button>`;
      else if (i === this.currentItemPage - 2 || i === this.currentItemPage + 2) html += `<span class="page-btn" style="border: none; background: none;">...</span>`;
    }
    if (this.currentItemPage < totalPages) {
      html += `
        <button class="page-btn" onclick="adminDashboard.changeItemPage(${this.currentItemPage + 1})">
          <i class="fas fa-chevron-right"></i>
        </button>`;
    }
    paginationEl.innerHTML = html;
  }
  changeItemPage(page) { this.currentItemPage = page; this.renderItemsTable(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  renderUsersTable() {
    const tbody = this._el('usersTableBody');
    if (!tbody || !this.users) return;
    const filteredUsers = this.filterUsersArray();
    if (filteredUsers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
            <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 10px; display: block; color: #ccc;"></i>
            No users found
          </td>
        </tr>
      `;
      return;
    }
    const studentsOnly = filteredUsers.filter(u => u.role === 'student');
    tbody.innerHTML = studentsOnly.map(user => this.createUserRow(user)).join('');
    this._qsa('.toggle-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = btn.dataset.userId;
        this.toggleUserStatus(userId);
      });
    });
    this._qsa('#usersTableBody tr').forEach(row => {
      row.addEventListener('click', (e) => {
        if (!e.target.closest('.action-buttons')) {
          const userId = row.querySelector('.toggle-user-btn')?.dataset.userId;
          if (userId) this.showUserDetails(userId);
        }
      });
    });
  }
  createUserRow(user) {
    const joinDate = new Date(user.created_at).toLocaleDateString();
    const statusClass = user.is_active ? 'status-active' : 'status-inactive';
    const statusText = user.is_active ? 'Active' : 'Inactive';
    const actionText = user.is_active ? 'Deactivate' : 'Activate';
    const actionIcon = user.is_active ? 'fa-user-slash' : 'fa-user-check';
    return `
      <tr style="cursor: pointer;">
        <td>${user.student_id || 'N/A'}</td>
        <td><strong>${user.full_name}</strong></td>
        <td>${user.email}</td>
        <td><span class="user-status ${user.role === 'admin' ? 'status-active' : 'status-pending'}">${user.role}</span></td>
        <td><span class="user-status ${statusClass}">${statusText}</span></td>
        <td>${joinDate}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon ${user.is_active ? 'delete' : 'approve'} toggle-user-btn" data-user-id="${user.id}" title="${actionText}">
              <i class="fas ${actionIcon}"></i>
            </button>
            <button class="btn-icon" onclick="adminDashboard.messageUser(${user.id})" title="Message">
              <i class="fas fa-envelope"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }
  filterUsersArray() {
    const term = (this._el('userSearch')?.value || '').toLowerCase();
    let filtered = [...(this.users || [])];
    if (term) filtered = filtered.filter(u => (u.full_name || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term) || (u.student_id || '').toLowerCase().includes(term));
    return filtered;
  }
  filterUsers() { this.renderUsersTable(); }
  async toggleUserStatus(userId) {
    const user = (this.users || []).find(u => u.id == userId);
    if (!user) return;
    const action = user.is_active ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      const response = await fetch(`/api/admin/users/${userId}/toggle-active`, { method: 'POST' });
      const data = await response.json();
      if (data.success) { this.showNotification(`User ${action}d successfully`, 'success'); await this.loadUsers(); this._closeModal('userDetailModal'); }
      else { this.showNotification(data.error || `Failed to ${action} user`, 'error'); }
    } catch { this.showNotification('Error updating user status', 'error'); }
  }
  async showUserDetails(userId) {
    const user = (this.users || []).find(u => u.id == userId);
    if (!user) { this.showNotification('User not found', 'error'); return; }
    const modal = this._el('userDetailModal');
    const content = this._el('userDetailsContent');
    content.innerHTML = `
      <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
        <div style="width: 80px; height: 80px; border-radius: 50%; background: #2E7D32; color: white; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold;">${user.full_name?.charAt(0).toUpperCase() || 'U'}</div>
        <div><h4 style="margin: 0 0 5px 0;">${user.full_name}</h4><div style="color: #666;">${user.email}</div></div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div class="detail-group"><div class="detail-label">Student ID</div><div class="detail-value">${user.student_id || 'N/A'}</div></div>
        <div class="detail-group"><div class="detail-label">Role</div><div class="detail-value">${user.role}</div></div>
        <div class="detail-group"><div class="detail-label">Status</div><div class="detail-value"><span class="user-status ${user.is_active ? 'status-active' : 'status-inactive'}">${user.is_active ? 'Active' : 'Inactive'}</span></div></div>
        <div class="detail-group"><div class="detail-label">Joined Date</div><div class="detail-value">${new Date(user.created_at).toLocaleDateString()}</div></div>
      </div>`;
    modal.dataset.userId = userId;
    this._openModal('userDetailModal');
  }
  switchTab(tabName) {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector(`.nav-link[data-tab="${tabName}"]`)?.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    this._el(`${tabName}Tab`)?.classList.add('active');
  }
  handleQuickAction(action) {
    switch (action) {
      case 'verify': this.switchTab('items'); break;
      case 'users': this.switchTab('users'); break;
      case 'messages': this.switchTab('messages'); break;
      case 'announce': this.switchTab('announcements'); this.showAnnouncementForm(); break;
    }
  }
  renderReportedMessages() {
    const container = this._el('reportedMessagesList');
    if (!container) return;
    if (!this.reportedMessages || this.reportedMessages.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <i class="fas fa-comment-slash" style="font-size: 2rem; margin-bottom: 10px; display: block; color: #ccc;"></i>
          No reported messages
        </div>`;
      return;
    }
    const html = this.reportedMessages.map(msg => `
      <div class="message-item">
        <div class="message-header">
          <div class="message-participants">
            <div class="message-from"><i class="fas fa-user"></i> ${msg.sender_name} (${msg.sender_email})</div>
            <div class="message-to"><i class="fas fa-arrow-right"></i> ${msg.receiver_name} (${msg.receiver_email})</div>
            ${msg.item_name ? `<div style=\"margin-top: 5px; font-size: 0.85rem; color: #666;\"><i class=\"fas fa-box\"></i> Related to: ${msg.item_name}</div>` : ''}
          </div>
          <div style="font-size: 0.85rem; color: #666;">${new Date(msg.reported_at).toLocaleString()}</div>
        </div>
        <div class="message-content">${msg.message}</div>
        ${msg.reported_reason ? `<div class=\"message-reason\"><strong><i class=\"fas fa-flag\"></i> Report Reason:</strong><br>${msg.reported_reason}</div>` : ''}
        <div style="display: flex; justify-content: flex-end; margin-top: 15px; gap: 10px;">
          <button class="btn btn-outline" onclick="adminDashboard.viewMessageDetails(${msg.id})"><i class="fas fa-eye"></i> View Details</button>
          <button class="btn btn-danger" onclick="adminDashboard.deleteMessage(${msg.id})"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>`).join('');
    container.innerHTML = html;
  }
  renderAnnouncements() {
    const container = this._el('announcementsList');
    if (!container) return;
    if (!this.announcements || this.announcements.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <i class="fas fa-bullhorn" style="font-size: 2rem; margin-bottom: 10px; display: block; color: #ccc;"></i>
          No announcements yet
        </div>`;
      return;
    }
    const html = this.announcements.map(ann => `
      <div class="announcement-item">
        <div class="announcement-header">
          <div>
            <h4 class="announcement-title">${ann.title}</h4>
            <div class="announcement-meta"><i class="fas fa-user"></i> ${ann.admin_name || 'Admin'} • <i class="far fa-clock"></i> ${new Date(ann.created_at).toLocaleString()} •
              <span class="user-status ${ann.is_active ? 'status-active' : 'status-inactive'}" style="margin-left: 10px;">${ann.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
          <div style="display: flex; gap: 5px;">
            <button class="btn-icon ${ann.is_active ? 'delete' : 'approve'}" onclick="adminDashboard.toggleAnnouncementStatus(${ann.id})" title="${ann.is_active ? 'Deactivate' : 'Activate'}"><i class="fas ${ann.is_active ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
            <button class="btn-icon" onclick="adminDashboard.showEditAnnouncement(${ann.id})" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn-icon delete" onclick="adminDashboard.deleteAnnouncement(${ann.id})" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="announcement-content">${ann.content}</div>
      </div>`).join('');
    container.innerHTML = html;
  }
  showEditAnnouncement(announcementId) {
    const ann = (this.announcements || []).find(a => a.id == announcementId);
    if (!ann) return;
    this._el('editAnnouncementId').value = ann.id;
    this._el('editAnnouncementTitle').value = ann.title;
    this._el('editAnnouncementContent').value = ann.content;
    this._openModal('editAnnouncementModal');
  }
  async submitEditAnnouncement() {
    const id = this._el('editAnnouncementId').value;
    const title = this._el('editAnnouncementTitle').value.trim();
    const content = this._el('editAnnouncementContent').value.trim();
    if (!title || !content) { this.showNotification('Please fill in both title and content', 'error'); return; }
    try {
      const response = await fetch(`/api/admin/announcements/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ title, content }), credentials: 'include' });
      let data; try { data = await response.json(); } catch (e) { const text = await response.text(); data = { success: false, error: text || 'Non-JSON response' }; }
      if (data.success) { this.showNotification('Announcement updated successfully', 'success'); this._closeModal('editAnnouncementModal'); await this.loadAnnouncements(); }
      else { this.showNotification(data.error || 'Failed to update announcement', 'error'); }
    } catch (error) { this.showNotification('Error updating announcement', 'error'); }
  }
  showAnnouncementForm() { const form = this._el('announcementForm'); if (form) { form.style.display = 'block'; form.scrollIntoView({ behavior: 'smooth' }); } }
  hideAnnouncementForm() { const form = this._el('announcementForm'); if (form) { form.style.display = 'none'; this._clearInput('announcementTitle'); this._clearInput('announcementContent'); } }
  async createAnnouncement() {
    const title = this._el('announcementTitle').value.trim();
    const content = this._el('announcementContent').value.trim();
    if (!title || !content) { this.showNotification('Please fill in both title and content', 'error'); return; }
    try {
      const response = await fetch('/api/admin/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }), credentials: 'include' });
      const data = await response.json();
      if (data.success) { this.showNotification('Announcement created successfully', 'success'); this.hideAnnouncementForm(); await this.loadAnnouncements(); }
      else { this.showNotification(data.error || 'Failed to create announcement', 'error'); }
    } catch (error) { this.showNotification('Error creating announcement', 'error'); }
  }
  async toggleAnnouncementStatus(announcementId) {
    try {
      const response = await fetch(`/api/admin/announcements/${announcementId}/toggle-active`, { method: 'POST', credentials: 'include' });
      const data = await response.json();
      if (data.success) { this.showNotification('Announcement status updated', 'success'); await this.loadAnnouncements(); }
      else { this.showNotification(data.error || 'Failed to update announcement', 'error'); }
    } catch (error) { this.showNotification('Error updating announcement', 'error'); }
  }
  async deleteAnnouncement(announcementId) {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      const response = await fetch(`/api/admin/announcements/${announcementId}`, { method: 'DELETE', credentials: 'include' });
      const data = await response.json();
      if (data.success) { this.showNotification('Announcement deleted successfully', 'success'); await this.loadAnnouncements(); }
      else { this.showNotification(data.error || 'Failed to delete announcement', 'error'); }
    } catch (error) { this.showNotification('Error deleting announcement', 'error'); }
  }
  async viewMessageDetails(messageId) {
    const message = (this.reportedMessages || []).find(m => m.id == messageId);
    if (!message) { this.showNotification('Message not found', 'error'); return; }
    const modal = this._el('messageDetailModal');
    const content = this._el('messageDetailsContent');
    content.innerHTML = `
      <div class="message-details">
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <div><strong>From:</strong> ${message.sender_name} (${message.sender_email})</div>
            <div style="font-size: 0.9rem; color: #666;">${new Date(message.created_at).toLocaleString()}</div>
          </div>
          <div style="margin-bottom: 10px;"><strong>To:</strong> ${message.receiver_name} (${message.receiver_email})</div>
          ${message.item_name ? `<div style=\"margin-bottom: 10px;\"><strong>Related Item:</strong> ${message.item_name}</div>` : ''}
        </div>
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #eee; margin-bottom: 20px;">
          <strong>Message Content:</strong>
          <div style="margin-top: 10px; padding: 15px; background: #f9f9f9; border-radius: 5px;">${message.message}</div>
        </div>
        ${message.reported_reason ? `<div style=\"background: #fff3cd; padding: 20px; border-radius: 8px; border: 1px solid #ffeaa7;\"><strong><i class=\"fas fa-flag\"></i> Report Reason:</strong><div style=\"margin-top: 10px; padding: 10px; background: white; border-radius: 5px;\">${message.reported_reason}</div></div>` : ''}
      </div>`;
    modal.dataset.messageId = messageId; this._openModal('messageDetailModal');
  }
  async deleteMessage(messageId) {
    if (!confirm('Are you sure you want to delete this reported message?')) return;
    try {
      const response = await fetch(`/api/admin/messages/${messageId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) { this.showNotification('Message deleted successfully', 'success'); await this.loadReportedMessages(); this._closeModal('messageDetailModal'); }
      else { this.showNotification(data.error || 'Failed to delete message', 'error'); }
    } catch (error) { this.showNotification('Error deleting message', 'error'); }
  }
  async markNotificationRead(notificationId) { try { await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST', credentials: 'include' }); await this.loadNotifications(); } catch {} }
  async markAllNotificationsRead() { try { await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' }); await this.loadNotifications(); } catch {} }
  async showItemDetails(itemId) {
    const item = (this.allReports || []).find(r => r.id == itemId);
    if (!item) { this.showNotification('Item not found', 'error'); return; }
    const modal = this._el('itemDetailModal');
    const content = this._el('itemDetailsContent');
    let imageHTML = '';
    if (item.image_base64) imageHTML = `<div class=\"detail-group\"><div class=\"detail-label\">Image</div><img src=\"data:image/jpeg;base64,${item.image_base64}\" alt=\"${item.item_name}\" class=\"detail-image\" style=\"max-width: 300px; max-height: 300px; object-fit: contain;\"></div>`;
    else if (item.image_url) imageHTML = `<div class=\"detail-group\"><div class=\"detail-label\">Image</div><img src=\"${item.image_url}\" alt=\"${item.item_name}\" class=\"detail-image\" style=\"max-width: 300px; max-height: 300px; object-fit: contain;\"></div>`;
    let actionsHTML = `
      ${item.status === 'claimed' ? `<div class=\"detail-group\"><div class=\"detail-label\">Claimed By</div><div class=\"detail-value\">${item.claimed_by_name || 'Unknown'}</div></div>` : ''}
      <div class="detail-group"><div class="detail-label">Set Claimer (Student ID)</div><div class="detail-value"><div style="display:flex; gap:8px; align-items:center;"><input type="text" id="setClaimerStudentId" class="form-control" placeholder="e.g., 20XX-XXXXX" style="max-width:220px;"><button class="btn btn-outline" onclick="adminDashboard.setClaimerByStudentId(${itemId})"><i class="fas fa-user-check"></i> Set Claimer</button></div></div></div>
      ${item.status === 'claimed' ? `<div style=\"display:flex; gap:10px; margin: 10px 0;\"><button class=\"btn btn-primary\" onclick=\"adminDashboard.markItemReturned(${itemId})\"><i class=\"fas fa-check\"></i> Mark Returned</button><button class=\"btn btn-danger\" onclick=\"adminDashboard.rejectClaim(${itemId})\"><i class=\"fas fa-times\"></i> Reject Claim</button>${item.claimed_by ? `<button class=\"btn btn-outline\" onclick=\"adminDashboard.requestProof(${itemId}, ${item.claimed_by})\"><i class=\"fas fa-bell\"></i> Request Proof</button>` : ''}</div>` : ''}
      <div style="display:flex; gap:10px; margin: 10px 0;"><button class="btn btn-danger" onclick="adminDashboard.permanentlyDeleteItem(${itemId})"><i class="fas fa-trash"></i> Permanently Delete</button></div>
      <div class="detail-group"><div class="detail-label">Message</div><div class="detail-value"><textarea id="adminMessageText" class="form-control" rows="3" placeholder="Type a message..."></textarea><input type="file" id="adminMessageImage" accept="image/*" style="margin-top:8px;"><div style="display:flex; gap:10px; margin-top:8px;"><button class="btn btn-outline" onclick="adminDashboard.sendAdminMessage(${item.reported_by})">Message Reporter</button>${item.claimed_by ? `<button class=\"btn btn-outline\" onclick=\"adminDashboard.sendAdminMessage(${item.claimed_by})\">Message Claimer</button>` : ''}</div></div></div>`;
    content.innerHTML = `
      <div>
        <div class="detail-group"><div class="detail-label">Item Name</div><div class="detail-value">${item.item_name}</div></div>
        <div class="detail-group"><div class="detail-label">Category</div><div class="detail-value">${item.category}</div></div>
        <div class="detail-group"><div class="detail-label">Description</div><div class="detail-value">${item.description}</div></div>
        <div class="detail-group"><div class="detail-label">Place</div><div class="detail-value">${item.place}</div></div>
        <div class="detail-group"><div class="detail-label">Date</div><div class="detail-value">${new Date(item.date_lost_found).toLocaleDateString()}</div></div>
      </div>
      <div>
        <div class="detail-group"><div class="detail-label">Status</div><div class="detail-value"><span class="user-status ${this.getStatusClass(item)}">${this.getStatusText(item)}</span></div></div>
        <div class="detail-group"><div class="detail-label">Contact Info</div><div class="detail-value">${item.contact_info}</div></div>
        <div class="detail-group"><div class="detail-label">Reported By</div><div class="detail-value">${item.full_name} (${item.student_id || 'N/A'})</div></div>
        <div class="detail-group"><div class="detail-label">Report Date</div><div class="detail-value">${new Date(item.created_at).toLocaleString()}</div></div>
        ${imageHTML}
        ${actionsHTML}
      </div>`;
    this._el('itemDetailModal').dataset.itemId = itemId; this._openModal('itemDetailModal');
  }
  getStatusClass(item) { if (item.status === 'claimed') return 'status-claimed'; if (item.status === 'found') return item.claimed_by ? 'status-claimed' : 'status-ready'; if (item.status === 'lost') return 'status-lost'; if (item.status === 'returned') return 'status-returned'; return 'status-pending'; }
  getStatusText(item) { if (item.status === 'claimed') return 'Claimed'; if (item.status === 'found') return item.claimed_by ? 'Claimed' : 'Ready'; if (item.status === 'lost') return 'Lost'; if (item.status === 'returned') return 'Returned'; return 'Pending'; }
  showAdminEditItemModal(itemId) {
    const item = (this.allReports || []).find(r => r.id == itemId);
    if (!item) return;
    this._el('adminEditItemId').value = item.id;
    this._el('adminEditItemName').value = item.item_name || '';
    this._el('adminEditItemCategory').value = item.category || 'others';
    this._el('adminEditItemDescription').value = item.description || '';
    this._el('adminEditItemPlace').value = item.place || '';
    this._el('adminEditItemDate').value = item.date_lost_found ? String(item.date_lost_found).split('T')[0] : '';
    this._el('adminEditItemStatus').value = item.status || 'found';
    this._el('adminEditContactInfo').value = item.contact_info || '';
    const fileInput = this._el('adminEditItemImage'); if (fileInput) fileInput.value = '';
    this._openModal('adminEditItemModal');
  }
  async submitAdminEditItem() {
    const itemId = this._el('adminEditItemId').value;
    const fd = new FormData();
    fd.append('itemName', this._el('adminEditItemName').value);
    fd.append('category', this._el('adminEditItemCategory').value);
    fd.append('description', this._el('adminEditItemDescription').value);
    fd.append('place', this._el('adminEditItemPlace').value);
    fd.append('dateLostFound', this._el('adminEditItemDate').value);
    fd.append('status', this._el('adminEditItemStatus').value);
    fd.append('contactInfo', this._el('adminEditContactInfo').value);
    const file = this._el('adminEditItemImage')?.files?.[0]; if (file) fd.append('itemImage', file);
    try {
      const res = await fetch(`/api/admin/items/${itemId}`, { method: 'PUT', body: fd, credentials: 'include' });
      const data = await res.json();
      if (data.success) { this.showNotification('Item updated successfully', 'success'); this._closeModal('adminEditItemModal'); await this.loadAllReports(); }
      else { this.showNotification(data.error || 'Failed to update item', 'error'); }
    } catch { this.showNotification('Error updating item', 'error'); }
  }
  setClaimerByStudentId(itemId) {
    const sid = this._el('setClaimerStudentId')?.value?.trim() || '';
    if (!sid) { this.showNotification('Enter a Student ID', 'error'); return; }
    const user = (this.users || []).find(u => (u.student_id || '').toLowerCase() === sid.toLowerCase());
    if (!user) { this.showNotification('No user found for that Student ID', 'error'); return; }
    this.approveClaim(itemId, user.id);
  }
  async markItemReturned(itemId) {
    try {
      const response = await fetch(`/api/admin/items/${itemId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'returned' }), credentials: 'include' });
      const data = await response.json();
      if (data.success) { this.showNotification('Item marked as returned', 'success'); await this.loadAllReports(); this._closeModal('itemDetailModal'); }
      else { this.showNotification(data.error || 'Failed to update item', 'error'); }
    } catch { this.showNotification('Error updating item', 'error'); }
  }
  async rejectClaim(itemId) {
    try {
      const response = await fetch(`/api/admin/items/${itemId}/reject-claim`, { method: 'POST', headers: { 'Accept': 'application/json' }, credentials: 'include' });
      let data; try { data = await response.json(); } catch (e) { const text = await response.text(); data = { success: false, error: text || 'Non-JSON response' }; }
      if (data.success) { this.showNotification(data.message || 'Claim rejected', 'success'); await this.loadAllReports(); this._closeModal('itemDetailModal'); }
      else { this.showNotification(data.error || 'Failed to reject claim', 'error'); }
    } catch { this.showNotification('Error rejecting claim', 'error'); }
  }
  async approveClaim(itemId, userId) {
    try {
      const response = await fetch(`/api/admin/items/${itemId}/approve-claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }), credentials: 'include' });
      const data = await response.json();
      if (data.success) { this.showNotification('Claim approved', 'success'); await this.loadAllReports(); this._closeModal('itemDetailModal'); }
      else { this.showNotification(data.error || 'Failed to approve claim', 'error'); }
    } catch { this.showNotification('Error approving claim', 'error'); }
  }
  renderNotifications(notifs) {
    const container = this._el('notificationsList');
    if (!container) return;
    if (!notifs || notifs.length === 0) { container.innerHTML = '<div class="empty-state">No notifications</div>'; return; }
    container.innerHTML = notifs.map(notif => {
      const relatedId = notif.related_id || '';
      const type = notif.type || '';
      const title = notif.title || '';
      const hasRelated = Boolean(relatedId);
      let relatedBtnLabel = 'View';
      if (type === 'message' || title === 'Message Reported') relatedBtnLabel = 'View Message';
      else relatedBtnLabel = 'Open Item';
      const relatedBtn = hasRelated ? `<button class="btn btn-primary btn-small view-related-btn"><i class="fas fa-eye"></i> ${relatedBtnLabel}</button>` : '';
      return `
      <div class="message-item ${notif.is_read ? '' : 'unread'}" data-notification-id="${notif.id}" data-related-id="${relatedId}" data-type="${type}" data-title="${title}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><strong>${title}</strong>${notif.is_read ? '' : '<span class="red-dot"></span>'}</div>
          <small>${new Date(notif.created_at).toLocaleString()}</small>
        </div>
        <div class="message-content">${notif.message || ''}</div>
        <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end;">
          ${relatedBtn}
          <button class="btn btn-outline btn-small mark-read-btn"><i class="fas fa-check"></i> Mark as Read</button>
          <button class="btn btn-danger btn-small delete-notif-btn"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>`;
    }).join('');
    container.querySelectorAll('.mark-read-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => { e.stopPropagation(); const id = btn.closest('.message-item').getAttribute('data-notification-id'); await this.markNotificationRead(id); });
    });
    container.querySelectorAll('.delete-notif-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => { e.stopPropagation(); const id = btn.closest('.message-item').getAttribute('data-notification-id'); try { await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' }); await this.loadNotifications(); } catch {} });
    });
    container.querySelectorAll('.view-related-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const parent = btn.closest('.message-item');
        const relatedId = parent.getAttribute('data-related-id');
        const type = parent.getAttribute('data-type');
        const title = parent.getAttribute('data-title');
        if (!relatedId) return;
        if (type === 'message' || title === 'Message Reported') this.viewMessageDetails(relatedId);
        else this.showItemDetails(relatedId);
      });
    });
  }
  messageUser(userId) {
    const user = (this.users || []).find(u => u.id == userId);
    this._el('adminMessageUserId').value = userId;
    const titleEl = this._el('adminUserMessageTitle'); if (titleEl) titleEl.textContent = `Message ${user?.full_name || 'User'}`;
    this._clearInput('adminUserMessageText');
    const fileInput = this._el('adminUserMessageImage'); if (fileInput) fileInput.value = '';
    this._openModal('adminUserMessageModal');
  }
  logout() { return Auth.logout(); }
  loadDashboardData() { return Data.loadDashboardData(this); }
  loadAllReports() { return Data.loadAllReports(this); }
  loadReportedMessages() { return Data.loadReportedMessages(this); }
  loadAnnouncements() { return Data.loadAnnouncements(this); }
  loadUsers() { return Data.loadUsers(this); }
  loadAllData() { return Data.loadAllData(this); }
  loadNotifications() { return Notifs.loadNotifications(this); }
  showNotificationsModal() { return Notifs.showNotificationsModal(this); }
  hideNotificationsModal() { return Notifs.hideNotificationsModal(); }

  async submitAdminUserMessage() {
    const receiverId = this._el('adminMessageUserId').value;
    const text = this._el('adminUserMessageText').value.trim();
    const fileInput = this._el('adminUserMessageImage');
    if (!text && !(fileInput && fileInput.files && fileInput.files[0])) { this.showNotification('Message is required', 'error'); return; }
    const fd = this._buildFormData({ receiver_id: receiverId, message: text || '' }, 'image', fileInput);
    const data = await this._postForm('/api/messages/send', fd);
    if (data.success) { this.showNotification('Message sent', 'success'); this._closeModal('adminUserMessageModal'); } else { this.showNotification(data.error || 'Failed to send message', 'error'); }
  }

  async sendAdminMessage(receiverId) {
    const itemId = this._el('itemDetailModal').dataset.itemId;
    const text = this._el('adminMessageText').value.trim();
    const fileInput = this._el('adminMessageImage');
    if (!text) { this.showNotification('Message is required', 'error'); return; }
    const fd = this._buildFormData({ receiver_id: receiverId, item_id: itemId, message: text }, 'image', fileInput);
    const data = await this._postForm('/api/messages/send', fd);
    if (data.success) { this.showNotification('Message sent', 'success'); this._clearInput('adminMessageText'); if (fileInput) fileInput.value = ''; } else { this.showNotification(data.error || 'Failed to send message', 'error'); }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const dashboard = new AdminDashboard();
  await dashboard.init();
  window.adminDashboard = dashboard;
});

export default AdminDashboard;
