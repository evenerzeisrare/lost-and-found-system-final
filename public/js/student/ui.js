import { getDashboardData } from './api.js';

export async function loadDashboardData(ctx) {
  try {
    const data = await getDashboardData();
    if (data && data.success) {
      ctx.currentItems = data.recentItems;
      renderItems(ctx, ctx.currentItems, 'recentItemsGrid');
      ctx.announcements = data.announcements;
      renderAnnouncements(data.announcements, 'announcementsList');
      const badge = document.getElementById('notificationBadge');
      if (badge) {
        badge.textContent = data.unreadNotifications;
        badge.style.display = (data.unreadNotifications > 0) ? 'flex' : 'none';
      }
    }
  } catch {}
}

export function renderItems(ctx, items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-box-open"></i>
        <p>No items found</p>
      </div>`;
    return;
  }
  const isMyItems = containerId.startsWith('myItemsGrid');
  container.innerHTML = items.map(item => createItemCard(ctx, item, isMyItems)).join('');
  const actions = ctx.actions || {};
  container.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', () => {
      const itemId = card.getAttribute('data-item-id');
      const item = items.find(i => i.id == itemId);
      if (item && typeof actions.showItemDetail === 'function') actions.showItemDetail(ctx, item);
    });
  });
  container.querySelectorAll('.message-owner-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ownerId = btn.getAttribute('data-owner-id');
      const ownerName = btn.getAttribute('data-owner-name');
      const itemId = btn.getAttribute('data-item-id');
      if (typeof actions.showMessageModal === 'function') actions.showMessageModal(ctx, ownerId, ownerName, itemId);
    });
  });
  container.querySelectorAll('.edit-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = btn.getAttribute('data-item-id');
      const item = items.find(i => i.id == itemId);
      if (item && typeof actions.showEditItemModal === 'function') actions.showEditItemModal(ctx, item);
    });
  });
  container.querySelectorAll('.delete-item-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const itemId = btn.getAttribute('data-item-id');
      if (!confirm('Delete this item?')) return;
      if (typeof actions.deleteItem === 'function') await actions.deleteItem(ctx, itemId);
    });
  });
}

export function createItemCard(ctx, item, isMyItems = false) {
  const date = new Date(item.created_at).toLocaleDateString();
  const statusClass = `status-${item.status}`;
  const statusText = item.status.charAt(0).toUpperCase() + item.status.slice(1);
  const imageSrc = item.image_url
    || (item.image_base64 ? `data:image/jpeg;base64,${item.image_base64}` : null)
    || 'https://via.placeholder.com/400x300/3CB371/FFFFFF?text=No+Image';
  const reporterName = item.reporter_name || 'Owner';
  const isOwner = item.reported_by === (ctx.currentUser?.id);
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
                            ${!isOwner ? `
                            <button class="btn btn-outline btn-small message-owner-btn" 
                                    data-owner-id="${item.reported_by}" 
                                    data-owner-name="${reporterName}"
                                    data-item-id="${item.id}">
                                <i class="fas fa-comment"></i> Message Owner
                            </button>
                            ` : ''}
                            ${isMyItems && isOwner ? `
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

export function renderAnnouncements(announcements, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!announcements || announcements.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-bullhorn"></i>No announcements yet</div>';
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

export async function loadAllAnnouncements(ctx) {
  try {
    const res = await fetch('/api/announcements', { credentials: 'include' });
    const data = await res.json();
    if (data && data.success) {
      ctx.announcements = data.announcements || [];
      renderAnnouncements(ctx.announcements, 'allAnnouncementsList');
    } else {
      renderAnnouncements([], 'allAnnouncementsList');
    }
  } catch {
    renderAnnouncements([], 'allAnnouncementsList');
  }
}
