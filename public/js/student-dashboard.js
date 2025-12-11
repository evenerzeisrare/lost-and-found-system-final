// Student Dashboard JavaScript
class StudentDashboard {
    constructor() {
        this.currentUser = null;
        this.currentItems = [];
        this.notifications = [];
        this.messages = [];
        this.announcements = [];
        this._msgInterval = null;
        this._lastUnreadMessages = undefined;
        
        this.init();
    }
    
    async init() {
        await this.checkAuth();
        this.initEventListeners();
        await this.loadDashboardData();
        this.showPage('dashboard');
        
        // Load notifications periodically
        setInterval(() => this.loadNotifications(), 30000);

        // Load messages periodically for badge updates
        await this.loadMessages();
        if (this._msgInterval) clearInterval(this._msgInterval);
        this._msgInterval = setInterval(() => this.loadMessages(), 5000);
    }
    
    async checkAuth() {
        try {
            const response = await fetch('/api/user', { credentials: 'include' });
            if (!response.ok) throw new Error('Not authenticated');
            
            const data = await response.json();
            this.currentUser = data.user;
            
            if (!this.currentUser) {
                window.location.href = '/login.html';
                return;
            }
            
            if (!this.currentUser.is_active) {
                alert('Your account has been deactivated. Please contact administrator.');
                await this.logout();
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
        
        // Update user name
        document.getElementById('userName').textContent = this.currentUser.full_name;
        document.getElementById('profileName').textContent = this.currentUser.full_name;
        document.getElementById('profileEmail').textContent = this.currentUser.email;
        const emailInput = document.getElementById('profileEmailInput');
        if (emailInput) emailInput.value = this.currentUser.email;
        document.getElementById('profileStudentId').textContent = `Student ID: ${this.currentUser.student_id || 'Not set'}`;
        
        // Update avatar
        const avatar = document.getElementById('profileAvatar');
        const avatarImg = document.getElementById('profileAvatarImg');
        if (this.currentUser.avatar_url && avatarImg) {
            avatarImg.src = this.currentUser.avatar_url;
            avatarImg.style.display = 'block';
            if (avatar) avatar.style.display = 'none';
        } else {
            if (avatar) {
                avatar.style.display = 'flex';
                avatar.textContent = this.currentUser.full_name?.charAt(0)?.toUpperCase() || 'S';
            }
            if (avatarImg) avatarImg.style.display = 'none';
        }
        
        // Update profile form
        if (this.currentUser.phone_number) {
            document.getElementById('phoneNumber').value = this.currentUser.phone_number;
        }
        if (this.currentUser.contact_method) {
            document.getElementById('contactMethod').value = this.currentUser.contact_method;
        }
        if (this.currentUser.student_id) {
            document.getElementById('studentId').value = this.currentUser.student_id;
        }
    }
    
    initEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                this.showPage(page);
                
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                // Close mobile menu on click
                if (window.innerWidth <= 768) {
                    document.getElementById('navLinks').classList.remove('active');
                }
            });
        });
        
        // Tabs for My Items page
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).classList.add('active');
                
                if (tabName === 'all') this.loadMyItems('all');
                else if (tabName === 'pending') this.loadMyItems('pending');
                else if (tabName === 'claimed') this.loadMyItems('claimed');
            });
        });
        
        // Report buttons
        document.getElementById('reportLostBtn')?.addEventListener('click', () => this.showReportModal('lost'));
        document.getElementById('reportFoundBtn')?.addEventListener('click', () => this.showReportModal('found'));
        document.getElementById('myReportLostBtn')?.addEventListener('click', () => this.showReportModal('lost'));
        document.getElementById('myReportFoundBtn')?.addEventListener('click', () => this.showReportModal('found'));
        
        // Modals
        document.getElementById('cancelReport')?.addEventListener('click', () => this.hideReportModal());
        document.getElementById('submitReport')?.addEventListener('click', () => this.submitReport());
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideReportModal();
                this.hideItemDetailModal();
                this.hideMessageModal();
                this.hideNotificationsModal();
                this.hideEditItemModal();
                this.hideChatModal();
                this.hideClaimProofModal();
            });
        });
        
        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
        
        // Notifications
        document.getElementById('notificationBell')?.addEventListener('click', () => this.showNotificationsModal());
        document.getElementById('markAllRead')?.addEventListener('click', () => this.markAllNotificationsRead());
        
        // Profile update
        document.getElementById('profileForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });
        
        // Search and filter
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.filterBrowseItems(e.target.value);
        });
        
        document.getElementById('categoryFilter')?.addEventListener('change', () => {
            this.filterBrowseItems();
        });
        
        document.getElementById('statusFilter')?.addEventListener('change', () => {
            this.filterBrowseItems();
        });
        
        // Image preview
        document.getElementById('itemImage')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('imagePreview').style.display = 'block';
                    document.getElementById('previewImage').src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
        
        // New message
        document.getElementById('deleteAllMessagesBtn')?.addEventListener('click', () => {
            this.deleteAllMessages();
        });
        
        document.getElementById('sendMessage')?.addEventListener('click', () => {
            this.sendMessage();
        });
        
        document.getElementById('cancelMessage')?.addEventListener('click', () => {
            this.hideMessageModal();
        });
        
        // Item actions
        document.getElementById('claimItemBtn')?.addEventListener('click', () => {
            this.claimItem();
        });
        
        document.getElementById('sendMessageBtn')?.addEventListener('click', () => {
            this.showSendMessageModal();
        });
        
        document.getElementById('submitClaimProofBtn')?.addEventListener('click', () => {
            this.showClaimProofModal();
        });
        document.getElementById('cancelClaimProof')?.addEventListener('click', () => {
            this.hideClaimProofModal();
        });
        document.getElementById('submitClaimProof')?.addEventListener('click', () => {
            this.submitClaimProof();
        });
    }
    
    async loadDashboardData() {
        try {
            const response = await fetch('/api/student/dashboard-data', { credentials: 'include' });
            const data = await response.json();
            
            if (data.success) {
                // Store and render recent items
                this.currentItems = data.recentItems;
                this.renderItems(this.currentItems, 'recentItemsGrid');
                
                // Load announcements
                this.announcements = data.announcements;
                this.renderAnnouncements(data.announcements, 'announcementsList');
                
                // Update notification badge
                document.getElementById('notificationBadge').textContent = data.unreadNotifications;
                if (data.unreadNotifications > 0) {
                    document.getElementById('notificationBadge').style.display = 'flex';
                }
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }
    
    async loadBrowseItems() {
        try {
            const response = await fetch('/api/items', { credentials: 'include' });
            const data = await response.json();
            
            if (data.success) {
                this.browseItems = data.items;
                this.filterBrowseItems();
            }
        } catch (error) {
            console.error('Error loading browse items:', error);
        }
    }
    
    async loadMyItems(filter = 'all') {
        try {
            const response = await fetch('/api/student/my-items', { credentials: 'include' });
            const data = await response.json();
            
            if (data.success) {
                let filteredItems = data.items;
                
                if (filter === 'pending') {
                    filteredItems = data.items.filter(item => item.status === 'pending');
                } else if (filter === 'claimed') {
                    filteredItems = data.items.filter(item => item.status === 'claimed');
                }
                
                const containerId = `myItemsGrid${filter.charAt(0).toUpperCase() + filter.slice(1)}`;
                this.renderItems(filteredItems, containerId);
            }
        } catch (error) {
            console.error('Error loading my items:', error);
        }
    }
    
    async loadMessages() {
        try {
            const response = await fetch('/api/messages', { credentials: 'include' });
            const data = await response.json();
            
            if (data.success) {
                this.messages = data.messages;
                this.renderMessages(data.messages);
                
                // Update message badge
                const unreadCount = data.messages.filter(m => !m.is_read && m.receiver_id === this.currentUser.id).length;
                const badge = document.getElementById('messageBadge');
                if (badge) {
                    badge.textContent = unreadCount;
                    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
                    if (typeof this._lastUnreadMessages === 'number' && unreadCount > this._lastUnreadMessages) {
                        badge.style.transition = 'transform 0.2s ease';
                        badge.style.transform = 'scale(1.2)';
                        setTimeout(() => { badge.style.transform = 'scale(1)'; }, 300);
                    }
                    this._lastUnreadMessages = unreadCount;
                }
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }
    
    async loadAllAnnouncements() {
        try {
            const response = await fetch('/api/announcements', { credentials: 'include' });
            const data = await response.json();
            
            if (data.success) {
                this.renderAnnouncements(data.announcements, 'allAnnouncementsList');
            }
        } catch (error) {
            console.error('Error loading announcements:', error);
        }
    }
    
    async loadNotifications() {
        try {
            const response = await fetch('/api/notifications', { credentials: 'include' });
            const data = await response.json();
            
            if (data.success) {
                const filtered = (data.notifications || []).filter(n => n.type !== 'message');
                this.notifications = filtered;
                const unreadFiltered = filtered.filter(n => !n.is_read).length;
                const notifBadge = document.getElementById('notificationBadge');
                if (notifBadge) {
                    notifBadge.textContent = unreadFiltered;
                    notifBadge.style.display = unreadFiltered > 0 ? 'flex' : 'none';
                }
                
                // Update notifications modal if open
                if (document.getElementById('notificationsModal').style.display === 'flex') {
                    this.renderNotifications(filtered);
                }
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }
    
    renderItems(items, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="fas fa-box-open"></i>
                    <p>No items found</p>
                </div>
            `;
            return;
        }
        
        const isMyItems = containerId.startsWith('myItemsGrid');
        container.innerHTML = items.map(item => this.createItemCard(item, isMyItems)).join('');
        
        // Add click events
        container.querySelectorAll('.item-card').forEach(card => {
            card.addEventListener('click', () => {
                const itemId = card.getAttribute('data-item-id');
                const item = items.find(i => i.id == itemId);
                if (item) this.showItemDetail(item);
            });
        });
        
        // Quick message owner button
        container.querySelectorAll('.message-owner-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const ownerId = btn.getAttribute('data-owner-id');
                const ownerName = btn.getAttribute('data-owner-name');
                const itemId = btn.getAttribute('data-item-id');
                this.showMessageModal(ownerId, ownerName, itemId);
            });
        });

        // Edit item
        container.querySelectorAll('.edit-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = btn.getAttribute('data-item-id');
                const item = items.find(i => i.id == itemId);
                if (item) this.showEditItemModal(item);
            });
        });

        // Delete item
        container.querySelectorAll('.delete-item-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const itemId = btn.getAttribute('data-item-id');
                if (!confirm('Delete this item?')) return;
                await this.deleteItem(itemId);
            });
        });
    }
    
    createItemCard(item, isMyItems = false) {
        const date = new Date(item.created_at).toLocaleDateString();
        const statusClass = `status-${item.status}`;
        const statusText = item.status.charAt(0).toUpperCase() + item.status.slice(1);
        const imageSrc = item.image_url
            || (item.image_base64 ? `data:image/jpeg;base64,${item.image_base64}` : null)
            || 'https://via.placeholder.com/400x300/3CB371/FFFFFF?text=No+Image';
        const reporterName = item.reporter_name || 'Owner';
        
        return `
            <div class="item-card" data-item-id="${item.id}">
                <div class="item-image">
                    <img src="${imageSrc}" 
                         alt="${item.item_name}"
                         onerror="this.src='https://via.placeholder.com/400x300/3CB371/FFFFFF?text=No+Image'">
                </div>
                <div class="item-details">
                    <div class="item-title">${item.item_name}</div>
                    <div class="item-meta">
                        <span class="item-category">${item.category}</span>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="item-description">
                        ${item.description || 'No description'}
                    </div>
                    <div class="item-footer" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                        <div>
                            <small><i class="fas fa-map-marker-alt"></i> ${item.place}</small>
                            <small style="margin-left:8px;">${date}</small>
                        </div>
                        <div style="display:flex;gap:8px;">
                            ${item.reported_by !== this.currentUser.id ? `
                            <button class="btn btn-outline btn-small message-owner-btn" 
                                    data-owner-id="${item.reported_by}" 
                                    data-owner-name="${reporterName}"
                                    data-item-id="${item.id}">
                                <i class="fas fa-comment"></i> Message Owner
                            </button>
                            ` : ''}
                            ${isMyItems && item.reported_by === this.currentUser.id ? `
                                <button class="btn btn-primary btn-small edit-item-btn" data-item-id="${item.id}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-danger btn-small delete-item-btn" data-item-id="${item.id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderAnnouncements(announcements, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!announcements || announcements.length === 0) {
            container.innerHTML = '<p>No announcements yet.</p>';
            return;
        }
        
        container.innerHTML = announcements.map(ann => `
            <div class="announcement-card">
                <div class="announcement-title">${ann.title}</div>
                <div class="announcement-meta">
                    <i class="fas fa-user"></i> ${ann.admin_name} • 
                    <i class="far fa-clock"></i> ${new Date(ann.created_at).toLocaleDateString()}
                </div>
                <div class="announcement-content">${ann.content}</div>
            </div>
        `).join('');
    }
    
    renderMessages(messages) {
        const container = document.getElementById('messagesList');
        if (!container) return;
        
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="empty-state">No messages yet.</div>';
            return;
        }
        
        // Group messages by sender/receiver
        const grouped = {};
        messages.forEach(msg => {
            const otherId = msg.sender_id === this.currentUser.id ? msg.receiver_id : msg.sender_id;
            const otherName = msg.sender_id === this.currentUser.id ? msg.receiver_name : msg.sender_name;
            const key = `${otherId}-${otherName}`;
            
            if (!grouped[key]) {
                grouped[key] = {
                    otherId: otherId,
                    otherName: otherName,
                    lastMessage: msg,
                    unread: msg.receiver_id === this.currentUser.id && !msg.is_read
                };
            }
        });
        
        const messagesHtml = Object.values(grouped).map(group => {
            const preview = group.lastMessage.image_url ? 'Photo' : (group.lastMessage.message || '').replace(/\s+/g, ' ').slice(0, 100);
            return `
            <div class="message-item ${group.unread ? 'unread' : ''}" data-user-id="${group.otherId}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong>${group.otherName}</strong>${group.unread ? '<span class="red-dot"></span>' : ''}
                    </div>
                    <small>${new Date(group.lastMessage.created_at).toLocaleString()}</small>
                </div>
                ${group.lastMessage.item_name ? `
                    <div style="font-size: 12px; color: #666; margin: 4px 0;">
                        Regarding: ${group.lastMessage.item_name}
                        ${group.lastMessage.item_id ? `<button class=\"btn btn-link view-item-btn\" data-item-id=\"${group.lastMessage.item_id}\" style=\"margin-left:8px;\">View item</button>` : ''}
                    </div>
                ` : ''}
                ${group.lastMessage.item_image_url ? `<div style="margin:4px 0;"><img src="${group.lastMessage.item_image_url}" alt="Item" style="max-width:120px;max-height:90px;border-radius:6px;" onerror="this.style.display='none'" /></div>` : ''}
                ${group.lastMessage.item_image_base64 ? `<div style="margin:4px 0;"><img src="data:image/jpeg;base64,${group.lastMessage.item_image_base64}" alt="Item" style="max-width:120px;max-height:90px;border-radius:6px;" onerror="this.style.display='none'" /></div>` : ''}
                ${group.lastMessage.image_url ? `<div style="margin:4px 0;"><img src="${group.lastMessage.image_url}" alt="Attachment" style="max-width:100px;max-height:80px;border-radius:6px;" onerror="this.style.display='none'" /></div>` : ''}
                <div class="message-content">${preview}</div>
            </div>`;
        }).join('');
        
        container.innerHTML = messagesHtml;
        
        // Add click events
        container.querySelectorAll('.message-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.getAttribute('data-user-id');
                const userName = item.querySelector('strong').textContent;
                this.showChatModal(userId, userName);
            });
        });
        container.querySelectorAll('.view-item-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const itemId = btn.getAttribute('data-item-id');
                if (!itemId) return;
                const item = await this.fetchItemById(itemId);
                if (item) this.showItemDetail(item);
            });
        });
    }

    async fetchItemById(itemId) {
        try {
            const response = await fetch(`/api/items/${itemId}`, { credentials: 'include' });
            const data = await response.json();
            if (data.success) return data.item;
        } catch (e) {}
        return null;
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
                <div class="message-content">${notif.message}</div>
                <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end;">
                    <button class="btn btn-outline btn-small mark-read-btn">
                        <i class="fas fa-check"></i> Mark as Read
                    </button>
                    <button class="btn btn-danger btn-small delete-notif-btn">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add click events
        container.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const notificationId = btn.closest('.message-item').getAttribute('data-notification-id');
                this.markNotificationRead(notificationId);
            });
        });
        container.querySelectorAll('.delete-notif-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const notificationId = btn.closest('.message-item').getAttribute('data-notification-id');
                if (!confirm('Delete this notification?')) return;
                try {
                    await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE', credentials: 'include' });
                    await this.loadNotifications();
                } catch (err) {
                    console.error('Delete notification error:', err);
                }
            });
        });
    }
    
    filterBrowseItems() {
        if (!this.browseItems) return;
        
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const category = document.getElementById('categoryFilter').value;
        const status = document.getElementById('statusFilter').value;
        
        let filtered = this.browseItems.filter(item => {
            const matchesSearch = !searchTerm || 
                item.item_name.toLowerCase().includes(searchTerm) ||
                item.description.toLowerCase().includes(searchTerm) ||
                item.place.toLowerCase().includes(searchTerm);
            
            const matchesCategory = category === 'all' || item.category === category;
            const matchesStatus = status === 'all' || item.status === status;
            
            return matchesSearch && matchesCategory && matchesStatus;
        });
        
        this.renderItems(filtered, 'browseItemsGrid');
    }
    
    showPage(page) {
        // Hide all pages
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.remove('active');
        });
        
        // Show selected page
        const pageElement = document.getElementById(`${page}Page`);
        if (pageElement) {
            pageElement.classList.add('active');
            
            // Load page-specific data
            switch(page) {
                case 'dashboard':
                    this.loadDashboardData();
                    break;
                case 'browse':
                    this.loadBrowseItems();
                    break;
                case 'my-items':
                    this.loadMyItems('all');
                    break;
                case 'messages':
                    this.loadMessages();
                    break;
                case 'announcements':
                    this.loadAllAnnouncements();
                    break;
                case 'profile':
                    // Profile is already loaded
                    break;
            }
        }
    }
    
    showReportModal(type) {
        const modal = document.getElementById('reportModal');
        const modalTitle = document.getElementById('modalTitle');
        
        modalTitle.textContent = type === 'lost' ? 'Report Lost Item' : 'Report Found Item';
        modal.setAttribute('data-report-type', type);
        
        // Set today's date as default
        document.getElementById('itemDate').valueAsDate = new Date();
        
        // Reset form
        document.getElementById('reportForm').reset();
        document.getElementById('imagePreview').style.display = 'none';
        
        // Show modal
        modal.style.display = 'flex';
    }
    
    hideReportModal() {
        document.getElementById('reportModal').style.display = 'none';
        document.getElementById('reportForm').reset();
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('itemImage').value = '';
    }
    
    async submitReport() {
        const form = document.getElementById('reportForm');
        const modal = document.getElementById('reportModal');
        const type = modal.getAttribute('data-report-type');
        const submitBtn = document.getElementById('submitReport');
        
        // Validate form
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        // Get form data
        const formData = new FormData();
        formData.append('itemName', document.getElementById('itemName').value);
        formData.append('category', document.getElementById('itemCategory').value);
        formData.append('description', document.getElementById('itemDescription').value);
        formData.append('place', document.getElementById('itemPlace').value);
        formData.append('dateLostFound', document.getElementById('itemDate').value);
        formData.append('status', type);
        formData.append('contactInfo', document.getElementById('contactInfo').value);
        
        const imageFile = document.getElementById('itemImage').files[0];
        if (imageFile) {
            formData.append('itemImage', imageFile);
        }
        
        // Disable button and show loading
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/api/items/report', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Item reported successfully!');
                this.hideReportModal();
                
                // Refresh data
                await this.loadDashboardData();
                await this.loadMyItems('all');
            } else {
                alert(data.error || 'Failed to report item');
            }
        } catch (error) {
            console.error('Error reporting item:', error);
            alert('Error reporting item. Please try again.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
    
    showItemDetail(item) {
        const modal = document.getElementById('itemDetailModal');
        
        // Populate modal
        document.getElementById('detailName').textContent = item.item_name;
        document.getElementById('detailCategory').textContent = item.category;
        document.getElementById('detailPlace').textContent = item.place;
        document.getElementById('detailDate').textContent = new Date(item.created_at).toLocaleDateString();
        document.getElementById('detailReporter').textContent = item.reporter_name || 'Anonymous';
        document.getElementById('detailDescription').textContent = item.description;
        document.getElementById('detailContact').textContent = item.contact_info;
        
        // Set status
        const statusElement = document.getElementById('detailStatus');
        statusElement.textContent = item.status.charAt(0).toUpperCase() + item.status.slice(1);
        statusElement.className = 'status-badge';
        statusElement.classList.add(`status-${item.status}`);
        
        // Set image
        document.getElementById('detailImage').src = item.image_url 
            || (item.image_base64 ? `data:image/jpeg;base64,${item.image_base64}` : null)
            || 'https://via.placeholder.com/400x300/3CB371/FFFFFF?text=No+Image';
        
        // Store item data
        modal.setAttribute('data-item-id', item.id);
        modal.setAttribute('data-reporter-id', item.reported_by);
        modal.setAttribute('data-item-name', item.item_name);
        
        // Show/hide buttons based on status
        const messageBtn = document.getElementById('sendMessageBtn');
        const proofBtn = document.getElementById('submitClaimProofBtn');
        const claimNotice = document.getElementById('claimRequirementNotice');
        
        if (item.status === 'found' && item.reported_by !== this.currentUser.id) {
            if (claimNotice) {
                claimNotice.style.display = 'block';
                claimNotice.textContent = 'Submit image proof so the owner of the item can verify ownership.';
            }
        } else {
            if (claimNotice) claimNotice.style.display = 'none';
        }

        if (item.reported_by !== this.currentUser.id) {
            messageBtn.style.display = 'inline-block';
        } else {
            messageBtn.style.display = 'none';
        }
        
        if (item.reported_by !== this.currentUser.id) {
            proofBtn.style.display = 'inline-block';
        } else {
            proofBtn.style.display = 'none';
        }

        const markClaimedBtn = document.getElementById('markClaimedByOwnerBtn');
        const markReturnedBtn = document.getElementById('markReturnedByOwnerBtn');
        if (item.reported_by === this.currentUser.id) {
            if (markClaimedBtn) markClaimedBtn.style.display = 'inline-block';
            if (markReturnedBtn) markReturnedBtn.style.display = 'inline-block';
            markClaimedBtn.onclick = () => this.updateItemStatus(item.id, 'claimed');
            markReturnedBtn.onclick = () => this.updateItemStatus(item.id, 'returned');
        } else {
            if (markClaimedBtn) markClaimedBtn.style.display = 'none';
            if (markReturnedBtn) markReturnedBtn.style.display = 'none';
        }
        
        modal.style.display = 'flex';
    }
    
    hideItemDetailModal() {
        document.getElementById('itemDetailModal').style.display = 'none';
    }
    
    async showClaimProofModal() {
        const itemId = document.getElementById('itemDetailModal').getAttribute('data-item-id');
        const modal = document.getElementById('claimProofModal');
        document.getElementById('claimProofItemId').value = itemId;
        modal.style.display = 'flex';
    }
    
    hideClaimProofModal() {
        const modal = document.getElementById('claimProofModal');
        if (modal) modal.style.display = 'none';
    }
    
    async submitClaimProof() {
        const itemId = document.getElementById('claimProofItemId').value;
        const note = document.getElementById('claimProofNote').value.trim();
        const file = document.getElementById('claimProofFile').files[0] || null;
        if (!file) {
            alert('Please attach an image proof before submitting.');
            return;
        }
        const formData = new FormData();
        if (note) formData.append('note', note);
        if (file) formData.append('proof', file);
        try {
            const res = await fetch(`/api/items/${itemId}/claim-proof`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                alert('Claim proof submitted');
                document.getElementById('claimProofModal').style.display = 'none';
                const detailModal = document.getElementById('itemDetailModal');
                if (detailModal && detailModal.style.display === 'flex') {
                    const notice = document.getElementById('claimRequirementNotice');
                    if (notice) notice.style.display = 'none';
                }
            } else {
                alert(data.error || 'Failed to submit proof');
            }
        } catch (e) {
            alert('Error submitting proof');
        }
    }

    async updateItemStatus(itemId, status) {
        try {
            const res = await fetch(`/api/items/${itemId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Status updated to ${status}`);
                this.hideItemDetailModal();
                await this.loadMyItems('all');
            } else {
                alert(data.error || 'Failed to update status');
            }
        } catch (e) {
            console.error('Update status error:', e);
            alert('Error updating status');
        }
    }
    
    
    showSendMessageModal() {
        const modal = document.getElementById('itemDetailModal');
        const itemId = modal.getAttribute('data-item-id');
        const reporterId = modal.getAttribute('data-reporter-id');
        const itemName = modal.getAttribute('data-item-name');
        
        this.showMessageModal(reporterId, itemName, itemId);
        const content = document.getElementById('messageContent');
        content.placeholder = 'Please send a message regarding this item.';
        content.value = `Hello, I am interested in "${itemName}". Please send me a message.`;
    }
    
    showNewMessageModal() {
        // For now, we'll show a prompt to enter user ID
        const userId = prompt('Enter the user ID to message:');
        if (userId) {
            const userName = prompt('Enter the user name:');
            if (userName) {
                this.showMessageModal(userId, userName);
            }
        }
    }
    
    showMessageModal(receiverId, receiverName, itemId = null) {
        const modal = document.getElementById('messageModal');
        
        document.getElementById('receiverId').value = receiverId;
        document.getElementById('messageReceiver').value = receiverName;
        document.getElementById('itemId').value = itemId || '';
        const msg = document.getElementById('messageContent');
        msg.placeholder = 'Please send a message regarding this item.';
        msg.value = '';
        
        modal.style.display = 'flex';
    }

    showEditItemModal(item) {
        const modal = document.getElementById('editItemModal');
        document.getElementById('editItemId').value = item.id;
        document.getElementById('editItemName').value = item.item_name;
        document.getElementById('editItemCategory').value = item.category;
        document.getElementById('editItemDescription').value = item.description || '';
        document.getElementById('editItemPlace').value = item.place || '';
        document.getElementById('editItemDate').value = item.date_lost_found ? item.date_lost_found.split('T')[0] : '';
        document.getElementById('editItemStatus').value = item.status;
        document.getElementById('editContactInfo').value = item.contact_info || '';
        document.getElementById('editItemImage').value = '';
        modal.style.display = 'flex';
    }

    hideEditItemModal() {
        const m = document.getElementById('editItemModal');
        if (m) m.style.display = 'none';
    }

    async submitEditItem() {
        const formData = new FormData();
        const itemId = document.getElementById('editItemId').value;
        formData.append('itemName', document.getElementById('editItemName').value);
        formData.append('category', document.getElementById('editItemCategory').value);
        formData.append('description', document.getElementById('editItemDescription').value);
        formData.append('place', document.getElementById('editItemPlace').value);
        formData.append('dateLostFound', document.getElementById('editItemDate').value);
        formData.append('status', document.getElementById('editItemStatus').value);
        formData.append('contactInfo', document.getElementById('editContactInfo').value);
        if (document.getElementById('editItemImage').files[0]) {
            formData.append('itemImage', document.getElementById('editItemImage').files[0]);
        }
        try {
            const response = await fetch(`/api/items/${itemId}`, {
                method: 'PUT',
                body: formData,
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                alert('Item updated successfully');
                document.getElementById('editItemModal').style.display = 'none';
                await this.loadMyItems('all');
            } else {
                alert(data.error || 'Failed to update item');
            }
        } catch (e) {
            console.error('Edit item error:', e);
            alert('Error updating item');
        }
    }

    async deleteItem(itemId) {
        try {
            const response = await fetch(`/api/items/${itemId}`, { method: 'DELETE', credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                alert('Item deleted');
                await this.loadMyItems('all');
            } else {
                alert(data.error || 'Failed to delete item');
            }
        } catch (e) {
            console.error('Delete item error:', e);
            alert('Error deleting item');
        }
    }

    async deleteAllMessages() {
        if (!confirm('Delete all your messages?')) return;
        try {
            const response = await fetch('/api/messages/delete-all', { method: 'POST', credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                alert('All messages deleted');
                await this.loadMessages();
                const badge = document.getElementById('messageBadge');
                if (badge) {
                    badge.textContent = '0';
                    badge.style.display = 'none';
                }
            } else {
                alert(data.error || 'Failed to delete messages');
            }
        } catch (e) {
            console.error('Delete all messages error:', e);
            alert('Error deleting messages');
        }
    }
    
    hideMessageModal() {
        document.getElementById('messageModal').style.display = 'none';
    }
    
    async sendMessage() {
        const receiverId = document.getElementById('receiverId').value;
        const message = document.getElementById('messageContent').value;
        const itemId = document.getElementById('itemId').value;
        const imageInput = document.getElementById('messageImage');
        
        if (!message.trim()) {
            alert('Please enter a message');
            return;
        }
        
        try {
            const fd = new FormData();
            fd.append('receiver_id', receiverId);
            fd.append('item_id', itemId || '');
            fd.append('message', message);
            if (imageInput && imageInput.files && imageInput.files[0]) {
                fd.append('image', imageInput.files[0]);
            }
            const response = await fetch('/api/messages/send', {
                method: 'POST',
                body: fd,
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                alert('Message sent successfully!');
                this.hideMessageModal();
                await this.loadMessages();
            } else {
                alert(data.error || 'Failed to send message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Error sending message. Please try again.');
        }
    }
    
    showChatModal(userId, userName) {
        const modal = document.getElementById('chatModal');
        document.getElementById('chatTitle').textContent = `Chat with ${userName}`;
        document.getElementById('chatReceiverId').value = userId;
        document.getElementById('chatInput').value = '';
        modal.style.display = 'flex';
        this.loadConversation(userId);
        if (this._chatInterval) clearInterval(this._chatInterval);
        this._chatInterval = setInterval(() => {
            if (document.getElementById('chatModal').style.display === 'flex') {
                this.loadConversation(userId);
            }
        }, 3000);
    }

    hideChatModal() {
        const m = document.getElementById('chatModal');
        if (m) m.style.display = 'none';
        if (this._chatInterval) {
            clearInterval(this._chatInterval);
            this._chatInterval = null;
        }
    }

    async loadConversation(otherId) {
        try {
            const response = await fetch(`/api/messages/conversation/${otherId}`, { credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                this.renderConversation(data.messages);
            }
        } catch (e) {
        }
    }

    renderConversation(messages) {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="empty-state">No messages yet.</div>';
            return;
        }
        const html = messages.map(m => {
            const isMine = m.sender_id === this.currentUser.id;
            const time = new Date(m.created_at).toLocaleTimeString();
            return `
                <div style="display:flex;justify-content:${isMine ? 'flex-end' : 'flex-start'}; margin: 12px 0;" data-message-id="${m.id}">
                    <div style="max-width:70%;padding:10px;border-radius:12px;${isMine ? 'background:#3CB371;color:white;' : 'background:#e5e7eb;'}">
                        ${m.item_name ? `<div style=\"font-size:12px;opacity:0.8;margin-bottom:4px;\">Regarding: ${m.item_name}</div>` : ''}
                        ${m.item_image_url ? `<div style=\"margin-bottom:6px;\"><img src=\"${m.item_image_url}\" alt=\"Item\" style=\"max-width:100%;border-radius:8px;\" onerror=\"this.style.display='none'\"/></div>` : ''}
                        ${m.item_image_base64 ? `<div style=\"margin-bottom:6px;\"><img src=\"data:image/jpeg;base64,${m.item_image_base64}\" alt=\"Item\" style=\"max-width:100%;border-radius:8px;\" onerror=\"this.style.display='none'\"/></div>` : ''}
                        ${m.image_url ? `
                        <div style="margin-bottom:8px;">
                            <img src="${m.image_url}" alt="Attachment" style="max-width:100%; border-radius:8px;" onerror="this.style.display='none'"/>
                        </div>
                        ` : ''}
                        <div>${m.message || ''}</div>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
                            <small style="opacity:0.8;">${time}</small>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <button class="btn btn-outline btn-small delete-message-btn" title="Delete on my side">
                                    <i class="fas fa-trash"></i>
                                </button>
                                <button class="btn btn-outline btn-small report-message-btn" title="Report this message">
                                    <i class="fas fa-flag"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;

        container.querySelectorAll('.delete-message-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const wrapper = btn.closest('[data-message-id]');
                const messageId = wrapper?.getAttribute('data-message-id');
                if (!messageId) return;
                if (!confirm('Delete this message on your side?')) return;
                try {
                    const res = await fetch(`/api/messages/${messageId}`, { method: 'DELETE', credentials: 'include' });
                    const data = await res.json();
                    if (data.success) {
                        const otherId = document.getElementById('chatReceiverId')?.value;
                        if (otherId) this.loadConversation(otherId);
                    } else {
                        alert(data.error || 'Failed to delete message');
                    }
                } catch (err) {
                    console.error('Delete message error:', err);
                    alert('Error deleting message');
                }
            });
        });

        container.querySelectorAll('.report-message-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const wrapper = btn.closest('[data-message-id]');
                const messageId = wrapper?.getAttribute('data-message-id');
                if (!messageId) return;
                const reason = prompt('Please describe the issue with this message:');
                if (reason === null) return;
                try {
                    const res = await fetch(`/api/messages/${messageId}/report`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ reason })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert('Message reported. An administrator has been notified.');
                    } else {
                        alert(data.error || 'Failed to report message');
                    }
                } catch (err) {
                    console.error('Report message error:', err);
                    alert('Error reporting message');
                }
            });
        });
    }

    async sendChatMessage() {
        const receiverId = document.getElementById('chatReceiverId').value;
        const input = document.getElementById('chatInput');
        const imageInput = document.getElementById('chatImage');
        const message = input.value.trim();
        if (!message && !(imageInput && imageInput.files && imageInput.files[0])) return;
        try {
            const fd = new FormData();
            fd.append('receiver_id', receiverId);
            fd.append('message', message || '');
            if (imageInput && imageInput.files && imageInput.files[0]) {
                fd.append('image', imageInput.files[0]);
            }
            const response = await fetch('/api/messages/send', {
                method: 'POST',
                body: fd,
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                input.value = '';
                if (imageInput) imageInput.value = '';
                await this.loadConversation(receiverId);
                await this.loadMessages();
            } else {
                alert(data.error || 'Failed to send message');
            }
        } catch (e) {
            alert('Error sending message');
        }
    }
    
    showNotificationsModal() {
        const modal = document.getElementById('notificationsModal');
        (async () => {
            try {
                await this.loadNotifications();
            } catch {}
            this.renderNotifications(this.notifications);
            modal.style.display = 'flex';
        })();
    }
    
    hideNotificationsModal() {
        document.getElementById('notificationsModal').style.display = 'none';
    }
    
    async markNotificationRead(notificationId) {
        try {
            await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'POST',
                credentials: 'include'
            });
            
            // Refresh notifications
            await this.loadNotifications();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }
    
    async markAllNotificationsRead() {
        try {
            await fetch('/api/notifications/read-all', {
                method: 'POST',
                credentials: 'include'
            });
            
            // Refresh notifications
            await this.loadNotifications();
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }
    
    async updateProfile() {
        const phoneNumber = document.getElementById('phoneNumber').value;
        const studentId = document.getElementById('studentId').value;
        const contactMethod = document.getElementById('contactMethod').value;
        const submitBtn = document.querySelector('#profileForm button[type="submit"]');
        const fileInput = document.getElementById('profileImage');
        
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        submitBtn.disabled = true;
        
        try {
            const formData = new FormData();
            formData.append('phoneNumber', phoneNumber);
            formData.append('studentId', studentId);
            formData.append('contactMethod', contactMethod);
            if (fileInput && fileInput.files[0]) {
                formData.append('profileImage', fileInput.files[0]);
            }
            
            const response = await fetch('/api/student/update-profile', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Profile updated successfully!');
                // Refresh user info
                const userRes = await fetch('/api/user', { credentials: 'include' });
                if (userRes.ok) {
                    const userData = await userRes.json();
                    this.currentUser = userData.user;
                    this.updateUserInfo();
                }
            } else {
                alert(data.error || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Error updating profile. Please try again.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
    
    async logout() {
        try {
            const response = await fetch('/api/logout', { credentials: 'include' });
            const data = await response.json();
            
            if (data.success) {
                window.location.href = '/login.html';
            } else {
                alert('Logout failed');
            }
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/login.html';
        }
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.__dashboardInstance = new StudentDashboard();
});
