
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
        
        this.init();
    }
    
    async init() {
        await this.checkAuth();
        this.initEventListeners();
        await this.loadDashboardData();
        await this.loadAllData();
        this.startNotificationPolling();
        
        setInterval(() => this.loadDashboardData(), 30000); // Every 30 seconds
    }
    
    async checkAuth() {
        try {
            console.log('Checking authentication...');
            const response = await fetch('/api/user');
            
            if (!response.ok) {
                console.error('Auth check failed with status:', response.status);
                window.location.href = '/login.html';
                return;
            }
            
            const data = await response.json();
            this.currentUser = data.user;
            
            if (!this.currentUser) {
                console.error('No user data received');
                window.location.href = '/login.html';
                return;
            }
            
            console.log('User authenticated:', this.currentUser.email, 'Role:', this.currentUser.role);
            
            if (this.currentUser.role !== 'admin') {
                console.log('User is not admin, redirecting...');
                window.location.href = '/student-dashboard.html';
                return;
            }
            
            this.updateUserInfo();
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/login.html';
        }
    }
    
    updateUserInfo() {
        if (!this.currentUser) return;
        

        const adminNameEl = document.getElementById('adminName');
        const adminAvatarEl = document.getElementById('adminAvatar');
        
        if (adminNameEl) {
            adminNameEl.textContent = this.currentUser.full_name || 'Admin';
        }
        
        if (adminAvatarEl) {
            if (this.currentUser.full_name) {
                adminAvatarEl.textContent = this.currentUser.full_name.charAt(0).toUpperCase();
            }
            if (this.currentUser.avatar_url) {
                adminAvatarEl.style.backgroundImage = `url('${this.currentUser.avatar_url}')`;
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
    
    initEventListeners() {
        document.getElementById('refreshData')?.addEventListener('click', async () => {
            await this.loadDashboardData();
            await this.loadAllData();
            this.showNotification('Data refreshed successfully', 'success');
        });
        
        document.getElementById('logoutBtn')?.addEventListener('click', async () => {
            await this.logout();
        });
        

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', () => {
                const action = card.getAttribute('data-action');
                this.handleQuickAction(action);
            });
        });
        
        document.getElementById('applyItemFilters')?.addEventListener('click', () => {
            this.filterItems();
        });
        
        document.getElementById('itemSearch')?.addEventListener('input', (e) => {
            this.debouncedFilterItems();
        });
        
        document.getElementById('itemStatusFilter')?.addEventListener('change', () => {
            this.filterItems();
        });
        
        document.getElementById('itemCategoryFilter')?.addEventListener('change', () => {
            this.filterItems();
        });
        
        document.getElementById('userSearch')?.addEventListener('input', (e) => {
            this.debouncedFilterUsers();
        });
        
        document.getElementById('createAnnouncementBtn')?.addEventListener('click', () => {
            this.showAnnouncementForm();
        });
        
        document.getElementById('cancelAnnouncement')?.addEventListener('click', () => {
            this.hideAnnouncementForm();
        });
        
        document.getElementById('newAnnouncementForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createAnnouncement();
        });
        
        
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', function() {
                const modal = this.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
        document.getElementById('closeItemModal')?.addEventListener('click', () => {
            document.getElementById('itemDetailModal').style.display = 'none';
        });
        
        document.getElementById('submitEditAnnouncement')?.addEventListener('click', async () => {
            await this.submitEditAnnouncement();
        });
        document.getElementById('cancelEditAnnouncement')?.addEventListener('click', () => {
            document.getElementById('editAnnouncementModal').style.display = 'none';
        });

        document.getElementById('toggleUserStatusBtn')?.addEventListener('click', async () => {
            const userId = document.getElementById('userDetailModal').dataset.userId;
            if (userId) {
                await this.toggleUserStatus(userId);
            }
        });
        document.getElementById('deleteMessageBtn')?.addEventListener('click', async () => {
            const messageId = document.getElementById('messageDetailModal').dataset.messageId;
            if (messageId) {
                await this.deleteMessage(messageId);
            }
        });
    }
    
    debouncedFilterItems() {
        clearTimeout(this.filterItemsTimeout);
        this.filterItemsTimeout = setTimeout(() => this.filterItems(), 300);
    }
    
    debouncedFilterUsers() {
        clearTimeout(this.filterUsersTimeout);
        this.filterUsersTimeout = setTimeout(() => this.filterUsers(), 300);
    }
    
    async loadDashboardData() {
        try {
            console.log('Loading dashboard data...');
            const response = await fetch('/api/admin/dashboard-data');
            
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            
            if (response.status === 403) {
                window.location.href = '/student-dashboard.html';
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.updateStats(data.stats);
                

                this.reports = data.recentReports || [];

                this.updateRecentActivity(data.recentReports);
                
                console.log('Dashboard data loaded successfully');
            } else {
                console.error('Failed to load dashboard data:', data.error);
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }
    
    updateStats(stats) {
        document.getElementById('pendingCount').textContent = stats.pending_verification || 0;
        document.getElementById('readyCount').textContent = stats.ready_for_claim || 0;
        document.getElementById('claimedCount').textContent = stats.claimed_this_month || 0;
        document.getElementById('unresolvedCount').textContent = stats.unresolved_reports || 0;
        document.getElementById('reportedCount').textContent = stats.reported_messages || 0;
        document.getElementById('inactiveCount').textContent = stats.inactive_users || 0;
        
        document.getElementById('pendingTrend').textContent = '+12%';
        document.getElementById('readyTrend').textContent = '+8%';
        document.getElementById('claimedTrend').textContent = '+15%';
        document.getElementById('unresolvedTrend').textContent = '-5%';
        document.getElementById('reportedTrend').textContent = '+3%';
        document.getElementById('inactiveTrend').textContent = '+2%';
    }
    
    updateRecentActivity(reports) {
        const container = document.getElementById('recentActivity');
        if (!container) return;
        
        if (!reports || reports.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">No recent activity</p>';
            return;
        }
        
        const activities = reports.slice(0, 5).map(report => {
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
    
    getStatusBadge(report) {
        let className = 'status-pending';
        let text = 'Pending';
        
        if (report.status === 'claimed') {
            className = 'status-claimed';
            text = 'Claimed';
        } else if (report.status === 'found') {
            className = report.claimed_by ? 'status-claimed' : 'status-ready';
            text = report.claimed_by ? 'Claimed' : 'Ready';
        } else if (report.status === 'lost') {
            className = 'status-lost';
            text = 'Lost';
        } else if (report.status === 'returned') {
            className = 'status-returned';
            text = 'Returned';
        } else {
            className = 'status-pending';
            text = 'Pending';
        }
        
        return `<span class="user-status ${className}">${text}</span>`;
    }
    
    async loadAllData() {
        await this.loadAllReports();
        await this.loadAllUsers();
        await this.loadReportedMessages();
        await this.loadAnnouncements();
    }
    
    async loadAllReports() {
        try {
            const response = await fetch('/api/admin/items');
            const data = await response.json();
            
            if (data.success) {
                this.allReports = data.items || [];
                this.renderItemsTable();
            }
        } catch (error) {
            console.error('Error loading all reports:', error);
        }
    }
    
    renderItemsTable() {
        const tbody = document.getElementById('itemsTableBody');
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
            return;
        }
        
        tbody.innerHTML = paginatedItems.map(item => this.createItemRow(item)).join('');
        
        document.querySelectorAll('.view-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = btn.dataset.itemId;
                this.showItemDetails(itemId);
            });
        });
        

        this.updateItemsPagination(filteredItems.length);
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
        let filtered = [...this.allReports];
        
        const searchTerm = document.getElementById('itemSearch')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('itemStatusFilter')?.value || 'all';
        const categoryFilter = document.getElementById('itemCategoryFilter')?.value || 'all';
        
        if (searchTerm) {
            filtered = filtered.filter(item =>
                item.item_name?.toLowerCase().includes(searchTerm) ||
                item.full_name?.toLowerCase().includes(searchTerm) ||
                item.category?.toLowerCase().includes(searchTerm) ||
                item.description?.toLowerCase().includes(searchTerm)
            );
        }
        
        if (statusFilter !== 'all') {
            filtered = filtered.filter(item => item.status === statusFilter);
        }
        
        if (categoryFilter !== 'all') {
            filtered = filtered.filter(item => item.category === categoryFilter);
        }
        
        return filtered;
    }
    
    filterItems() {
        this.currentItemPage = 1;
        this.renderItemsTable();
    }
    
    updateItemsPagination(totalItems) {
        const paginationEl = document.getElementById('itemsPagination');
        if (!paginationEl) return;
        
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        

        if (this.currentItemPage > 1) {
            paginationHTML += `
                <button class="page-btn" onclick="adminDashboard.changeItemPage(${this.currentItemPage - 1})">
                    <i class="fas fa-chevron-left"></i>
                </button>
            `;
        }
        

        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentItemPage) {
                paginationHTML += `<button class="page-btn active">${i}</button>`;
            } else if (
                i === 1 || 
                i === totalPages || 
                (i >= this.currentItemPage - 1 && i <= this.currentItemPage + 1)
            ) {
                paginationHTML += `<button class="page-btn" onclick="adminDashboard.changeItemPage(${i})">${i}</button>`;
            } else if (i === this.currentItemPage - 2 || i === this.currentItemPage + 2) {
                paginationHTML += `<span class="page-btn" style="border: none; background: none;">...</span>`;
            }
        }

        if (this.currentItemPage < totalPages) {
            paginationHTML += `
                <button class="page-btn" onclick="adminDashboard.changeItemPage(${this.currentItemPage + 1})">
                    <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }
        
        paginationEl.innerHTML = paginationHTML;
    }
    
    changeItemPage(page) {
        this.currentItemPage = page;
        this.renderItemsTable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    async loadAllUsers() {
        try {
            const response = await fetch('/api/admin/users');
            const data = await response.json();
            
            if (data.success) {
                this.users = data.users || [];
                this.renderUsersTable();
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }
    
    renderUsersTable() {
        const tbody = document.getElementById('usersTableBody');
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
        
        // Only show students
        const studentsOnly = filteredUsers.filter(u => u.role === 'student');
        tbody.innerHTML = studentsOnly.map(user => this.createUserRow(user)).join('');
        

        document.querySelectorAll('.toggle-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = btn.dataset.userId;
                this.toggleUserStatus(userId);
            });
        });
        
        document.querySelectorAll('#usersTableBody tr').forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.closest('.action-buttons')) {
                    const userId = row.querySelector('.toggle-user-btn')?.dataset.userId;
                    if (userId) {
                        this.showUserDetails(userId);
                    }
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
                        <button class="btn-icon ${user.is_active ? 'delete' : 'approve'} toggle-user-btn" 
                                data-user-id="${user.id}" title="${actionText}">
                            <i class="fas ${actionIcon}"></i>
                        </button>
                        <button class="btn-icon" onclick="adminDashboard.messageUser(${user.id})" title="Message">
                            <i class="fas fa-comment-dots"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    filterUsersArray() {
        let filtered = [...this.users];
        
        const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
        const roleFilter = document.getElementById('userRoleFilter')?.value || 'all';
        const statusFilter = document.getElementById('userStatusFilter')?.value || 'all';
        
        if (searchTerm) {
            filtered = filtered.filter(user =>
                user.full_name?.toLowerCase().includes(searchTerm) ||
                user.email?.toLowerCase().includes(searchTerm) ||
                user.student_id?.toLowerCase().includes(searchTerm)
            );
        }
        
        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === roleFilter);
        }
        
        if (statusFilter !== 'all') {
            const isActive = statusFilter === 'active';
            filtered = filtered.filter(user => user.is_active === isActive);
        }
        
        return filtered;
    }
    
    filterUsers() {
        this.renderUsersTable();
    }
    
    async loadReportedMessages() {
        try {
            const response = await fetch('/api/admin/reported-messages');
            const data = await response.json();
            
            if (data.success) {
                this.reportedMessages = data.messages || [];
                this.renderReportedMessages();
            }
        } catch (error) {
            console.error('Error loading reported messages:', error);
        }
    }
    
    renderReportedMessages() {
        const container = document.getElementById('reportedMessagesList');
        if (!container) return;
        
        if (!this.reportedMessages || this.reportedMessages.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-comment-slash" style="font-size: 2rem; margin-bottom: 10px; display: block; color: #ccc;"></i>
                    No reported messages
                </div>
            `;
            return;
        }
        
        const messagesHTML = this.reportedMessages.map(msg => `
            <div class="message-item">
                <div class="message-header">
                    <div class="message-participants">
                        <div class="message-from">
                            <i class="fas fa-user"></i> ${msg.sender_name} (${msg.sender_email})
                        </div>
                        <div class="message-to">
                            <i class="fas fa-arrow-right"></i> ${msg.receiver_name} (${msg.receiver_email})
                        </div>
                        ${msg.item_name ? `
                            <div style="margin-top: 5px; font-size: 0.85rem; color: #666;">
                                <i class="fas fa-box"></i> Related to: ${msg.item_name}
                            </div>
                        ` : ''}
                    </div>
                    <div style="font-size: 0.85rem; color: #666;">
                        ${new Date(msg.reported_at).toLocaleString()}
                    </div>
                </div>
                <div class="message-content">
                    ${msg.message}
                </div>
                ${msg.reported_reason ? `
                    <div class="message-reason">
                        <strong><i class="fas fa-flag"></i> Report Reason:</strong><br>
                        ${msg.reported_reason}
                    </div>
                ` : ''}
                <div style="display: flex; justify-content: flex-end; margin-top: 15px; gap: 10px;">
                    <button class="btn btn-outline" onclick="adminDashboard.viewMessageDetails(${msg.id})">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    <button class="btn btn-danger" onclick="adminDashboard.deleteMessage(${msg.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = messagesHTML;
    }
    
    async loadAnnouncements() {
        try {
            const response = await fetch('/api/admin/all-announcements', { credentials: 'include' });
            const data = await response.json();
            
            if (data.success) {
                this.announcements = data.announcements || [];
                this.renderAnnouncements();
            }
        } catch (error) {
            console.error('Error loading announcements:', error);
        }
    }
    
    renderAnnouncements() {
        const container = document.getElementById('announcementsList');
        if (!container) return;
        
        if (!this.announcements || this.announcements.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-bullhorn" style="font-size: 2rem; margin-bottom: 10px; display: block; color: #ccc;"></i>
                    No announcements yet
                </div>
            `;
            return;
        }
        
        const announcementsHTML = this.announcements.map(ann => `
            <div class="announcement-item">
                <div class="announcement-header">
                    <div>
                        <h4 class="announcement-title">${ann.title}</h4>
                        <div class="announcement-meta">
                            <i class="fas fa-user"></i> ${ann.admin_name || 'Admin'} • 
                            <i class="far fa-clock"></i> ${new Date(ann.created_at).toLocaleString()} •
                            <span class="user-status ${ann.is_active ? 'status-active' : 'status-inactive'}" style="margin-left: 10px;">
                                ${ann.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-icon ${ann.is_active ? 'delete' : 'approve'}" 
                                onclick="adminDashboard.toggleAnnouncementStatus(${ann.id})" 
                                title="${ann.is_active ? 'Deactivate' : 'Activate'}">
                            <i class="fas ${ann.is_active ? 'fa-eye-slash' : 'fa-eye'}"></i>
                        </button>
                        <button class="btn-icon" onclick="adminDashboard.showEditAnnouncement(${ann.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete" onclick="adminDashboard.deleteAnnouncement(${ann.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="announcement-content">
                    ${ann.content}
                </div>
            </div>
        `).join('');
        
        container.innerHTML = announcementsHTML;
    }

    showEditAnnouncement(announcementId) {
        const ann = this.announcements.find(a => a.id == announcementId);
        if (!ann) return;
        const modal = document.getElementById('editAnnouncementModal');
        document.getElementById('editAnnouncementId').value = ann.id;
        document.getElementById('editAnnouncementTitle').value = ann.title;
        document.getElementById('editAnnouncementContent').value = ann.content;
        modal.style.display = 'flex';
    }

    async submitEditAnnouncement() {
        const id = document.getElementById('editAnnouncementId').value;
        const title = document.getElementById('editAnnouncementTitle').value.trim();
        const content = document.getElementById('editAnnouncementContent').value.trim();
        if (!title || !content) {
            this.showNotification('Please fill in both title and content', 'error');
            return;
        }
        try {
            const response = await fetch(`/api/admin/announcements/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ title, content }),
                credentials: 'include'
            });
            let data;
            try {
                data = await response.json();
            } catch (e) {
                const text = await response.text();
                data = { success: false, error: text || 'Non-JSON response' };
            }
            if (data.success) {
                this.showNotification('Announcement updated successfully', 'success');
                document.getElementById('editAnnouncementModal').style.display = 'none';
                await this.loadAnnouncements();
            } else {
                this.showNotification(data.error || 'Failed to update announcement', 'error');
            }
        } catch (error) {
            console.error('Edit announcement error:', error);
            this.showNotification('Error updating announcement', 'error');
        }
    }
    
    // Analytics removed
    

    switchTab(tabName) {

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`.nav-link[data-tab="${tabName}"]`).classList.add('active');
        

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }
    
    handleQuickAction(action) {
        switch(action) {
            case 'verify':
                this.switchTab('items');
                break;
            case 'users':
                this.switchTab('users');
                break;
            case 'messages':
                this.switchTab('messages');
                break;
            case 'announce':
                this.switchTab('announcements');
                this.showAnnouncementForm();
                break;
        }
    }
    
    showAnnouncementForm() {
        const form = document.getElementById('announcementForm');
        if (form) {
            form.style.display = 'block';
            form.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    hideAnnouncementForm() {
        const form = document.getElementById('announcementForm');
        if (form) {
            form.style.display = 'none';
            document.getElementById('announcementTitle').value = '';
            document.getElementById('announcementContent').value = '';
        }
    }

    async showItemDetails(itemId) {
        try {
            const item = this.allReports.find(r => r.id == itemId);
            if (!item) {
                this.showNotification('Item not found', 'error');
                return;
            }
            
            const modal = document.getElementById('itemDetailModal');
            const content = document.getElementById('itemDetailsContent');

            let imageHTML = '';
            if (item.image_base64) {
                imageHTML = `
                    <div class="detail-group">
                        <div class="detail-label">Image</div>
                        <img src="data:image/jpeg;base64,${item.image_base64}" 
                             alt="${item.item_name}" 
                             class="detail-image"
                             style="max-width: 300px; max-height: 300px; object-fit: contain;">
                    </div>
                `;
            } else if (item.image_url) {
                imageHTML = `
                    <div class="detail-group">
                        <div class="detail-label">Image</div>
                        <img src="${item.image_url}" 
                             alt="${item.item_name}" 
                             class="detail-image"
                             style="max-width: 300px; max-height: 300px; object-fit: contain;">
                    </div>
                `;
            }
            
            let actionsHTML = `
                ${item.status === 'claimed' ? `
                <div class="detail-group">
                    <div class="detail-label">Claimed By</div>
                    <div class="detail-value">${item.claimed_by_name || 'Unknown'}</div>
                </div>` : ''}
                <div class="detail-group">
                    <div class="detail-label">Set Claimer (Student ID)</div>
                    <div class="detail-value">
                        <div style="display:flex; gap:8px; align-items:center;">
                            <input type="text" id="setClaimerStudentId" class="form-control" placeholder="e.g., 20XX-XXXXX" style="max-width:220px;">
                            <button class="btn btn-outline" onclick="adminDashboard.setClaimerByStudentId(${itemId})">
                                <i class="fas fa-user-check"></i> Set Claimer
                            </button>
                        </div>
                    </div>
                </div>
                ${item.status === 'claimed' ? `
                <div style="display:flex; gap:10px; margin: 10px 0;">
                    <button class="btn btn-primary" onclick="adminDashboard.markItemReturned(${itemId})">
                        <i class="fas fa-check"></i> Mark Returned
                    </button>
                    <button class="btn btn-danger" onclick="adminDashboard.rejectClaim(${itemId})">
                        <i class="fas fa-times"></i> Reject Claim
                    </button>
                    ${item.claimed_by ? `
                    <button class="btn btn-outline" onclick="adminDashboard.requestProof(${itemId}, ${item.claimed_by})">
                        <i class="fas fa-bell"></i> Request Proof
                    </button>` : ''}
                </div>` : ''}
                <div style="display:flex; gap:10px; margin: 10px 0;">
                    <button class="btn btn-danger" onclick="adminDashboard.permanentlyDeleteItem(${itemId})">
                        <i class="fas fa-trash"></i> Permanently Delete
                    </button>
                </div>
                <div class="detail-group">
                    <div class="detail-label">Message</div>
                    <div class="detail-value">
                        <textarea id="adminMessageText" class="form-control" rows="3" placeholder="Type a message..."></textarea>
                        <input type="file" id="adminMessageImage" accept="image/*" style="margin-top:8px;">
                        <div style="display:flex; gap:10px; margin-top:8px;">
                            <button class="btn btn-outline" onclick="adminDashboard.sendAdminMessage(${item.reported_by})">Message Reporter</button>
                            ${item.claimed_by ? `<button class=\"btn btn-outline\" onclick=\"adminDashboard.sendAdminMessage(${item.claimed_by})\">Message Claimer</button>` : ''}
                        </div>
                    </div>
                </div>
            `;

            content.innerHTML = `
                <div>
                    <div class="detail-group">
                        <div class="detail-label">Item Name</div>
                        <div class="detail-value">${item.item_name}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Category</div>
                        <div class="detail-value">${item.category}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Description</div>
                        <div class="detail-value">${item.description}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Place</div>
                        <div class="detail-value">${item.place}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Date</div>
                        <div class="detail-value">${new Date(item.date_lost_found).toLocaleDateString()}</div>
                    </div>
                </div>
                <div>
                    <div class="detail-group">
                        <div class="detail-label">Status</div>
                        <div class="detail-value">
                            <span class="user-status ${this.getStatusClass(item)}">
                                ${this.getStatusText(item)}
                            </span>
                        </div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Contact Info</div>
                        <div class="detail-value">${item.contact_info}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Reported By</div>
                        <div class="detail-value">${item.full_name} (${item.student_id || 'N/A'})</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Report Date</div>
                        <div class="detail-value">${new Date(item.created_at).toLocaleString()}</div>
                    </div>
                    ${imageHTML}
                    ${actionsHTML}
                </div>
            `;
            
            modal.dataset.itemId = itemId;
            modal.style.display = 'flex';
            
        } catch (error) {
            console.error('Error showing item details:', error);
            this.showNotification('Error loading item details', 'error');
        }
    }

    showAdminEditItemModal(itemId) {
        const item = this.allReports.find(r => r.id == itemId);
        if (!item) return;
        const modal = document.getElementById('adminEditItemModal');
        document.getElementById('adminEditItemId').value = item.id;
        document.getElementById('adminEditItemName').value = item.item_name || '';
        document.getElementById('adminEditItemCategory').value = item.category || 'others';
        document.getElementById('adminEditItemDescription').value = item.description || '';
        document.getElementById('adminEditItemPlace').value = item.place || '';
        document.getElementById('adminEditItemDate').value = item.date_lost_found ? String(item.date_lost_found).split('T')[0] : '';
        document.getElementById('adminEditItemStatus').value = item.status || 'found';
        document.getElementById('adminEditContactInfo').value = item.contact_info || '';
        document.getElementById('adminEditItemImage').value = '';
        modal.style.display = 'flex';
    }

    async submitAdminEditItem() {
        const itemId = document.getElementById('adminEditItemId').value;
        const formData = new FormData();
        formData.append('itemName', document.getElementById('adminEditItemName').value);
        formData.append('category', document.getElementById('adminEditItemCategory').value);
        formData.append('description', document.getElementById('adminEditItemDescription').value);
        formData.append('place', document.getElementById('adminEditItemPlace').value);
        formData.append('dateLostFound', document.getElementById('adminEditItemDate').value);
        formData.append('status', document.getElementById('adminEditItemStatus').value);
        formData.append('contactInfo', document.getElementById('adminEditContactInfo').value);
        const file = document.getElementById('adminEditItemImage').files[0];
        if (file) formData.append('itemImage', file);
        try {
            const res = await fetch(`/api/admin/items/${itemId}`, { method: 'PUT', body: formData, credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                this.showNotification('Item updated successfully', 'success');
                document.getElementById('adminEditItemModal').style.display = 'none';
                await this.loadAllReports();
            } else {
                this.showNotification(data.error || 'Failed to update item', 'error');
            }
        } catch (e) {
            this.showNotification('Error updating item', 'error');
        }
    }

    setClaimerByStudentId(itemId) {
        const sidInput = document.getElementById('setClaimerStudentId');
        const sid = sidInput ? sidInput.value.trim() : '';
        if (!sid) {
            this.showNotification('Enter a Student ID', 'error');
            return;
        }
        const user = this.users.find(u => (u.student_id || '').toLowerCase() === sid.toLowerCase());
        if (!user) {
            this.showNotification('No user found for that Student ID', 'error');
            return;
        }
        this.approveClaim(itemId, user.id);
    }

    messageUser(userId) {
        const user = this.users.find(u => u.id == userId);
        const modal = document.getElementById('adminUserMessageModal');
        document.getElementById('adminMessageUserId').value = userId;
        document.getElementById('adminUserMessageTitle').textContent = `Message ${user?.full_name || 'User'}`;
        document.getElementById('adminUserMessageText').value = '';
        document.getElementById('adminUserMessageImage').value = '';
        modal.style.display = 'flex';
    }

    async submitAdminUserMessage() {
        const receiverId = document.getElementById('adminMessageUserId').value;
        const text = document.getElementById('adminUserMessageText').value.trim();
        const fileInput = document.getElementById('adminUserMessageImage');
        if (!text && !(fileInput && fileInput.files && fileInput.files[0])) {
            this.showNotification('Message is required', 'error');
            return;
        }
        const fd = new FormData();
        fd.append('receiver_id', receiverId);
        fd.append('message', text || '');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            fd.append('image', fileInput.files[0]);
        }
        try {
            const res = await fetch('/api/messages/send', { method: 'POST', body: fd, credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                this.showNotification('Message sent', 'success');
                document.getElementById('adminUserMessageModal').style.display = 'none';
            } else {
                this.showNotification(data.error || 'Failed to send message', 'error');
            }
        } catch (e) {
            this.showNotification('Error sending message', 'error');
        }
    }

    async loadNotifications() {
        try {
            const res = await fetch('/api/notifications', { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                const badge = document.getElementById('notificationBadge');
                if (badge) badge.textContent = String(data.unreadCount || 0);
                if (typeof this._lastUnreadCount === 'number' && data.unreadCount > this._lastUnreadCount) {
                    const latest = data.notifications && data.notifications.length ? data.notifications[0] : null;
                    const title = latest?.title || 'New Notification';
                    const msg = latest?.message || '';
                    this.showNotification(`${title}${msg ? ': ' + msg : ''}`, 'info');
                }
                this._lastUnreadCount = data.unreadCount || 0;
                if (document.getElementById('notificationsModal')?.style.display === 'flex') {
                    this.renderNotifications(data.notifications || []);
                }
            }
        } catch (e) {}
    }

    startNotificationPolling() {
        this._lastUnreadCount = undefined;
        this.loadNotifications();
        if (this._notifInterval) clearInterval(this._notifInterval);
        this._notifInterval = setInterval(() => this.loadNotifications(), 5000);
    }

    showNotificationsModal() {
        const modal = document.getElementById('notificationsModal');
        (async () => {
            try {
                await this.loadNotifications();
            } catch {}
            const list = document.getElementById('notificationsList');
            if (list && !list.innerHTML) list.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading notifications...</div>';
            modal.style.display = 'flex';
        })();
    }

    hideNotificationsModal() {
        const modal = document.getElementById('notificationsModal');
        if (modal) modal.style.display = 'none';
    }

    renderNotifications(notifications) {
        const container = document.getElementById('notificationsList');
        if (!container) return;
        if (!notifications || notifications.length === 0) {
            container.innerHTML = '<div class="empty-state">No notifications</div>';
            return;
        }
        container.innerHTML = notifications.map(notif => `
            <div class="message-item ${notif.is_read ? '' : 'unread'}" data-notification-id="${notif.id}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong>${notif.title}</strong>${notif.is_read ? '' : '<span class="red-dot"></span>'}
                    </div>
                    <small>${new Date(notif.created_at).toLocaleString()}</small>
                </div>
                <div class="message-content">${notif.message || ''}</div>
                <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end;">
                    <button class="btn btn-outline btn-small mark-read-btn"><i class="fas fa-check"></i> Mark as Read</button>
                    <button class="btn btn-danger btn-small delete-notif-btn"><i class="fas fa-trash"></i> Delete</button>
                </div>
            </div>
        `).join('');
        container.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.closest('.message-item').getAttribute('data-notification-id');
                await this.markNotificationRead(id);
            });
        });
        container.querySelectorAll('.delete-notif-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.closest('.message-item').getAttribute('data-notification-id');
                try {
                    await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' });
                    await this.loadNotifications();
                } catch {}
            });
        });
    }

    async markNotificationRead(notificationId) {
        try {
            await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST', credentials: 'include' });
            await this.loadNotifications();
        } catch {}
    }

    async markAllNotificationsRead() {
        try {
            await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
            await this.loadNotifications();
        } catch {}
    }
    
    getStatusClass(item) {
        if (item.status === 'claimed') return 'status-claimed';
        if (item.status === 'found') return item.claimed_by ? 'status-claimed' : 'status-ready';
        if (item.status === 'lost') return 'status-lost';
        if (item.status === 'returned') return 'status-returned';
        return 'status-pending';
    }
    
    getStatusText(item) {
        if (item.status === 'claimed') return 'Claimed';
        if (item.status === 'found') return item.claimed_by ? 'Claimed' : 'Ready';
        if (item.status === 'lost') return 'Lost';
        if (item.status === 'returned') return 'Returned';
        return 'Pending';
    }
    
    async showUserDetails(userId) {
        try {
            const user = this.users.find(u => u.id == userId);
            if (!user) {
                this.showNotification('User not found', 'error');
                return;
            }
            
            const modal = document.getElementById('userDetailModal');
            const content = document.getElementById('userDetailsContent');
            
            content.innerHTML = `
                <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: #2E7D32; 
                         color: white; display: flex; align-items: center; justify-content: center; 
                         font-size: 2rem; font-weight: bold;">
                        ${user.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                        <h4 style="margin: 0 0 5px 0;">${user.full_name}</h4>
                        <div style="color: #666;">${user.email}</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="detail-group">
                        <div class="detail-label">Student ID</div>
                        <div class="detail-value">${user.student_id || 'N/A'}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Role</div>
                        <div class="detail-value">${user.role}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Status</div>
                        <div class="detail-value">
                            <span class="user-status ${user.is_active ? 'status-active' : 'status-inactive'}">
                                ${user.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Joined Date</div>
                        <div class="detail-value">${new Date(user.created_at).toLocaleDateString()}</div>
                    </div>
                </div>
            `;
            
            modal.dataset.userId = userId;
            modal.style.display = 'flex';
            
        } catch (error) {
            console.error('Error showing user details:', error);
            this.showNotification('Error loading user details', 'error');
        }
    }
    
    async viewMessageDetails(messageId) {
        try {
            const message = this.reportedMessages.find(m => m.id == messageId);
            if (!message) {
                this.showNotification('Message not found', 'error');
                return;
            }
            
            const modal = document.getElementById('messageDetailModal');
            const content = document.getElementById('messageDetailsContent');
            
            content.innerHTML = `
                <div class="message-details">
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <div>
                                <strong>From:</strong> ${message.sender_name} (${message.sender_email})
                            </div>
                            <div style="font-size: 0.9rem; color: #666;">
                                ${new Date(message.created_at).toLocaleString()}
                            </div>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>To:</strong> ${message.receiver_name} (${message.receiver_email})
                        </div>
                        ${message.item_name ? `
                            <div style="margin-bottom: 10px;">
                                <strong>Related Item:</strong> ${message.item_name}
                            </div>
                        ` : ''}
                    </div>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #eee; margin-bottom: 20px;">
                        <strong>Message Content:</strong>
                        <div style="margin-top: 10px; padding: 15px; background: #f9f9f9; border-radius: 5px;">
                            ${message.message}
                        </div>
                    </div>
                    
                    ${message.reported_reason ? `
                        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border: 1px solid #ffeaa7;">
                            <strong><i class="fas fa-flag"></i> Report Reason:</strong>
                            <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 5px;">
                                ${message.reported_reason}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            
            modal.dataset.messageId = messageId;
            modal.style.display = 'flex';
            
        } catch (error) {
            console.error('Error showing message details:', error);
            this.showNotification('Error loading message details', 'error');
        }
    }
    
    // Action Methods
    // Approval flow removed
    
    async toggleUserStatus(userId) {
        const user = this.users.find(u => u.id == userId);
        if (!user) return;
        
        const action = user.is_active ? 'deactivate' : 'activate';
        if (!confirm(`Are you sure you want to ${action} this user?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/users/${userId}/toggle-active`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`User ${action}d successfully`, 'success');
                
                await this.loadAllUsers();
                
                document.getElementById('userDetailModal').style.display = 'none';
            } else {
                this.showNotification(data.error || `Failed to ${action} user`, 'error');
            }
        } catch (error) {
            console.error('Error toggling user status:', error);
            this.showNotification('Error updating user status', 'error');
        }
    }
    
    async deleteMessage(messageId) {
        if (!confirm('Are you sure you want to delete this reported message?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/messages/${messageId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Message deleted successfully', 'success');
                
                await this.loadReportedMessages();
                
                document.getElementById('messageDetailModal').style.display = 'none';
            } else {
                this.showNotification(data.error || 'Failed to delete message', 'error');
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            this.showNotification('Error deleting message', 'error');
        }
    }
    
    async createAnnouncement() {
        const title = document.getElementById('announcementTitle').value.trim();
        const content = document.getElementById('announcementContent').value.trim();
        
        if (!title || !content) {
            this.showNotification('Please fill in both title and content', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/admin/announcements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title, content }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Announcement created successfully', 'success');
                this.hideAnnouncementForm();
                
                await this.loadAnnouncements();
            } else {
                this.showNotification(data.error || 'Failed to create announcement', 'error');
            }
        } catch (error) {
            console.error('Error creating announcement:', error);
            this.showNotification('Error creating announcement', 'error');
        }
    }
    
    async toggleAnnouncementStatus(announcementId) {
        try {
            const response = await fetch(`/api/admin/announcements/${announcementId}/toggle-active`, {
                method: 'POST',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Announcement status updated', 'success');
                await this.loadAnnouncements();
            } else {
                this.showNotification(data.error || 'Failed to update announcement', 'error');
            }
        } catch (error) {
            console.error('Error toggling announcement status:', error);
            this.showNotification('Error updating announcement', 'error');
        }
    }
    
    async deleteAnnouncement(announcementId) {
        if (!confirm('Are you sure you want to delete this announcement?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/announcements/${announcementId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Announcement deleted successfully', 'success');
                await this.loadAnnouncements();
            } else {
                this.showNotification(data.error || 'Failed to delete announcement', 'error');
            }
        } catch (error) {
            console.error('Error deleting announcement:', error);
            this.showNotification('Error deleting announcement', 'error');
        }
    }
    async markItemReturned(itemId) {
        try {
            const response = await fetch(`/api/admin/items/${itemId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'returned' }),
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                this.showNotification('Item marked as returned', 'success');
                await this.loadAllReports();
                document.getElementById('itemDetailModal').style.display = 'none';
            } else {
                this.showNotification(data.error || 'Failed to update item', 'error');
            }
        } catch (error) {
            console.error('Mark returned error:', error);
            this.showNotification('Error updating item', 'error');
        }
    }
    async rejectClaim(itemId) {
        try {
            const response = await fetch(`/api/admin/items/${itemId}/reject-claim`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            let data;
            try {
                data = await response.json();
            } catch (e) {
                const text = await response.text();
                data = { success: false, error: text || 'Non-JSON response' };
            }
            if (data.success) {
                this.showNotification(data.message || 'Claim rejected', 'success');
                await this.loadAllReports();
                document.getElementById('itemDetailModal').style.display = 'none';
            } else {
                this.showNotification(data.error || 'Failed to reject claim', 'error');
            }
        } catch (error) {
            console.error('Reject claim error:', error);
            this.showNotification('Error rejecting claim', 'error');
        }
    }
    async sendAdminMessage(receiverId) {
        try {
            const itemId = document.getElementById('itemDetailModal').dataset.itemId;
            const text = document.getElementById('adminMessageText').value.trim();
            const fileInput = document.getElementById('adminMessageImage');
            if (!text) {
                this.showNotification('Message is required', 'error');
                return;
            }
            const fd = new FormData();
            fd.append('receiver_id', receiverId);
            fd.append('item_id', itemId);
            fd.append('message', text);
            if (fileInput && fileInput.files && fileInput.files[0]) {
                fd.append('image', fileInput.files[0]);
            }
            const res = await fetch('/api/messages/send', {
                method: 'POST',
                body: fd,
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                this.showNotification('Message sent', 'success');
                document.getElementById('adminMessageText').value = '';
                if (fileInput) fileInput.value = '';
            } else {
                this.showNotification(data.error || 'Failed to send message', 'error');
            }
        } catch (error) {
            console.error('Send message error:', error);
            this.showNotification('Error sending message', 'error');
        }
    }

    requestProof(itemId, claimerId) {
        try {
            const item = this.allReports.find(r => r.id == itemId);
            const textarea = document.getElementById('adminMessageText');
            if (textarea) {
                const name = item?.item_name || 'your claimed item';
                textarea.value = `Hello, please submit an image proof for "${name}" so we can verify ownership.`;
            }
            if (claimerId) {
                this.sendAdminMessage(claimerId);
            }
        } catch (e) {
            this.showNotification('Failed to send proof request', 'error');
        }
    }

    async approveClaim(itemId, claimerId) {
        try {
            const res = await fetch(`/api/admin/items/${itemId}/approve-claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ claimer_id: claimerId })
            });
            const data = await res.json();
            if (data.success) {
                this.showNotification('Claim approved', 'success');
                document.getElementById('itemDetailModal').style.display = 'none';
                await this.loadAllReports();
            } else {
                this.showNotification(data.error || 'Failed to approve claim', 'error');
            }
        } catch (e) {
            console.error('Approve claim error:', e);
            this.showNotification('Error approving claim', 'error');
        }
    }

    async permanentlyDeleteItem(itemId) {
        if (!confirm('Permanently delete this item? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/admin/items/${itemId}`, { method: 'DELETE', credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                this.showNotification('Item permanently deleted', 'success');
                document.getElementById('itemDetailModal').style.display = 'none';
                await this.loadAllReports();
            } else {
                this.showNotification(data.error || 'Failed to delete item', 'error');
            }
        } catch (e) {
            this.showNotification('Error deleting item', 'error');
        }
    }

    async rejectProof(itemId, claimerId) {
        try {
            const reason = prompt('Enter rejection reason (optional):') || '';
            const res = await fetch(`/api/admin/items/${itemId}/reject-proof`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ claimer_id: claimerId, reason })
            });
            const data = await res.json();
            if (data.success) {
                this.showNotification('Proof rejected', 'warning');
                await this.loadAllReports();
            } else {
                this.showNotification(data.error || 'Failed to reject proof', 'error');
            }
        } catch (e) {
            console.error('Reject proof error:', e);
            this.showNotification('Error rejecting proof', 'error');
        }
    }
    
    async logout() {
        try {
            const response = await fetch('/api/logout');
            const data = await response.json();
            
            if (data.success) {
                window.location.href = '/login.html';
            } else {
                this.showNotification('Logout failed', 'error');
            }
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/login.html';
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 400px;
        `;
        
        const colors = {
            success: '#4CAF50',
            error: '#F44336',
            info: '#2196F3',
            warning: '#FF9800'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            info: 'info-circle',
            warning: 'exclamation-triangle'
        };
        notification.innerHTML = `
            <i class="fas fa-${icons[type]}" style="margin-right: 10px;"></i>
            ${message}
        `;
        

        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    
        if (!document.querySelector('#notification-animations')) {
            const style = document.createElement('style');
            style.id = 'notification-animations';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

let adminDashboard;

document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new AdminDashboard();
    window.adminDashboard = adminDashboard;
});
