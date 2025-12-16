import { getMessages, sendMessage as apiSendMessage, getConversation, deleteAllMessages as apiDeleteAllMessages, deleteMessage as apiDeleteMessage, reportMessage as apiReportMessage } from './api.js';

export async function loadMessages(ctx) {
  try {
    const data = await getMessages();
    if (data && data.success) {
      ctx.messages = data.messages;
      renderMessages(ctx, data.messages);
      const unreadCount = data.messages.filter(m => !m.is_read && m.receiver_id === ctx.currentUser?.id).length;
      const badge = document.getElementById('messageBadge');
      if (badge) {
        badge.textContent = String(unreadCount);
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        if (typeof ctx._lastUnreadMessages === 'number' && unreadCount > ctx._lastUnreadMessages) {
          badge.style.transition = 'transform 0.2s ease';
          badge.style.transform = 'scale(1.2)';
          setTimeout(() => { badge.style.transform = 'scale(1)'; }, 300);
        }
        ctx._lastUnreadMessages = unreadCount;
      }
    }
  } catch {}
}

export function renderMessages(ctx, messages) {
  const container = document.getElementById('messagesList');
  if (!container) return;
  if (!messages || messages.length === 0) { container.innerHTML = '<div class="empty-state">No messages yet.</div>'; return; }
  const grouped = {};
  messages.forEach(msg => {
    const otherId = msg.sender_id === ctx.currentUser?.id ? msg.receiver_id : msg.sender_id;
    const otherName = msg.sender_id === ctx.currentUser?.id ? msg.receiver_name : msg.sender_name;
    const key = `${otherId}-${otherName}`;
    if (!grouped[key]) {
      grouped[key] = { otherId, otherName, lastMessage: msg, unread: msg.receiver_id === ctx.currentUser?.id && !msg.is_read };
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
  const actions = ctx.actions || {};
  container.querySelectorAll('.message-item').forEach(item => {
    item.addEventListener('click', () => {
      const userId = item.getAttribute('data-user-id');
      const userName = item.querySelector('strong')?.textContent || '';
      if (typeof actions.showChatModal === 'function') actions.showChatModal(ctx, userId, userName);
    });
  });
  container.querySelectorAll('.view-item-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const itemId = btn.getAttribute('data-item-id');
      if (!itemId) return;
      if (typeof actions.fetchItemById === 'function' && typeof actions.showItemDetail === 'function') {
        const item = await actions.fetchItemById(ctx, itemId);
        if (item) actions.showItemDetail(ctx, item);
      }
    });
  });
}

export function hideMessageModal() { const m = document.getElementById('messageModal'); if (m) m.style.display = 'none'; }

export function showMessageModal(ctx, receiverId, receiverName, itemId = null) {
  const modal = document.getElementById('messageModal');
  const rId = document.getElementById('receiverId'); if (rId) rId.value = receiverId;
  const rName = document.getElementById('messageReceiver'); if (rName) rName.value = receiverName;
  const iId = document.getElementById('itemId'); if (iId) iId.value = itemId || '';
  const msg = document.getElementById('messageContent');
  if (msg) {
    if (itemId) { msg.placeholder = 'Good evening, I found your lost item at [LOCATION]. Please claim it at the guard house.'; msg.value = 'Good evening, I found your lost item at [LOCATION]. Please claim it at the guard house.'; }
    else { msg.placeholder = 'Please send a message regarding this item.'; msg.value = ''; }
  }
  if (modal) modal.style.display = 'flex';
}

export async function sendMessage(ctx) {
  const receiverId = document.getElementById('receiverId')?.value;
  const message = document.getElementById('messageContent')?.value || '';
  const itemId = document.getElementById('itemId')?.value || '';
  const imageInput = document.getElementById('messageImage');
  if (!message.trim()) { alert('Please enter a message'); return; }
  try {
    const fd = new FormData();
    fd.append('receiver_id', receiverId);
    fd.append('item_id', itemId || '');
    fd.append('message', message);
    if (imageInput && imageInput.files && imageInput.files[0]) fd.append('image', imageInput.files[0]);
    const data = await apiSendMessage(fd);
    if (data && data.success) { alert('Message sent successfully!'); hideMessageModal(); await loadMessages(ctx); }
    else { alert(data?.error || 'Failed to send message'); }
  } catch { alert('Error sending message. Please try again.'); }
}

export function showSendMessageModal(ctx) {
  const modal = document.getElementById('itemDetailModal');
  const itemId = modal?.getAttribute('data-item-id');
  const reporterId = modal?.getAttribute('data-reporter-id');
  const reporterName = modal?.getAttribute('data-reporter-name') || 'Owner';
  showMessageModal(ctx, reporterId, reporterName, itemId);
  const content = document.getElementById('messageContent');
  if (content) { content.placeholder = 'Good evening, I found your lost item at [LOCATION]. Please claim it at the guard house.'; content.value = 'Good evening, I found your lost item at [LOCATION]. Please claim it at the guard house.'; }
}

export function showNewMessageModal(ctx) {
  const userId = prompt('Enter the user ID to message:');
  if (userId) { const userName = prompt('Enter the user name:'); if (userName) showMessageModal(ctx, userId, userName); }
}

export function showChatModal(ctx, userId, userName) {
  const modal = document.getElementById('chatModal');
  const title = document.getElementById('chatTitle'); if (title) title.textContent = `Chat with ${userName}`;
  const rId = document.getElementById('chatReceiverId'); if (rId) rId.value = userId;
  const input = document.getElementById('chatInput'); if (input) input.value = '';
  if (modal) modal.style.display = 'flex';
  loadConversation(ctx, userId);
  if (ctx._chatInterval) clearInterval(ctx._chatInterval);
  ctx._chatInterval = setInterval(() => { if (document.getElementById('chatModal')?.style.display === 'flex') loadConversation(ctx, userId); }, 3000);
}

export function hideChatModal(ctx) {
  const m = document.getElementById('chatModal'); if (m) m.style.display = 'none';
  if (ctx._chatInterval) { clearInterval(ctx._chatInterval); ctx._chatInterval = null; }
}

export async function loadConversation(ctx, otherId) {
  try {
    const data = await getConversation(otherId);
    if (data && data.success) renderConversation(ctx, data.messages);
  } catch {}
}

export function renderConversation(ctx, messages) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  if (!messages || messages.length === 0) { container.innerHTML = '<div class="empty-state">No messages yet.</div>'; return; }
  const html = messages.map(m => {
    const isMine = m.sender_id === ctx.currentUser?.id;
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
        const data = await apiDeleteMessage(messageId);
        if (data && data.success) { const otherId = document.getElementById('chatReceiverId')?.value; if (otherId) loadConversation(ctx, otherId); }
        else { alert(data?.error || 'Failed to delete message'); }
      } catch { alert('Error deleting message'); }
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
        const data = await apiReportMessage(messageId, reason);
        if (data && data.success) { alert('Message reported. An administrator has been notified.'); }
        else { alert(data?.error || 'Failed to report message'); }
      } catch { alert('Error reporting message'); }
    });
  });
}

export async function sendChatMessage(ctx) {
  const receiverId = document.getElementById('chatReceiverId')?.value;
  const input = document.getElementById('chatInput');
  const imageInput = document.getElementById('chatImage');
  const message = input?.value?.trim() || '';
  if (!message && !(imageInput && imageInput.files && imageInput.files[0])) return;
  try {
    const fd = new FormData();
    fd.append('receiver_id', receiverId);
    fd.append('message', message || '');
    if (imageInput && imageInput.files && imageInput.files[0]) fd.append('image', imageInput.files[0]);
    const data = await apiSendMessage(fd);
    if (data && data.success) { if (input) input.value = ''; if (imageInput) imageInput.value = ''; await loadConversation(ctx, receiverId); await loadMessages(ctx); }
    else { alert(data?.error || 'Failed to send message'); }
  } catch { alert('Error sending message'); }
}

export async function deleteAllMessages(ctx) {
  if (!confirm('Delete all your messages?')) return;
  try {
    const data = await apiDeleteAllMessages();
    if (data && data.success) { alert('All messages deleted'); await loadMessages(ctx); const badge = document.getElementById('messageBadge'); if (badge) { badge.textContent = '0'; badge.style.display = 'none'; } }
    else { alert(data?.error || 'Failed to delete messages'); }
  } catch { alert('Error deleting messages'); }
}
