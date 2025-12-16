export function el(id) { return document.getElementById(id); }
export function qsa(sel) { return document.querySelectorAll(sel); }
export function openModal(id) { const m = el(id); if (m) m.style.display = 'flex'; }
export function closeModal(id) { const m = el(id); if (m) m.style.display = 'none'; }
export function clearInput(id) { const e = el(id); if (e) e.value = ''; }
export function updateBadge(id, value) { const e = el(id); if (e) e.textContent = String(value); }

export function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `position: fixed; top: 20px; right: 20px; padding: 15px 20px; border-radius: 8px; color: white; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; animation: slideIn 0.3s ease; max-width: 400px;`;
  const colors = { success: '#4CAF50', error: '#F44336', info: '#2196F3', warning: '#FF9800' };
  notification.style.backgroundColor = colors[type] || colors.info;
  const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle', warning: 'exclamation-triangle' };
  notification.innerHTML = `<i class="fas fa-${icons[type]}" style="margin-right: 10px;"></i>${message}`;
  document.body.appendChild(notification);
  setTimeout(() => { notification.style.animation = 'slideOut 0.3s ease'; setTimeout(() => { notification.remove(); }, 300); }, 5000);
  if (!document.querySelector('#notification-animations')) {
    const style = document.createElement('style');
    style.id = 'notification-animations';
    style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }`;
    document.head.appendChild(style);
  }
}

export function buildFormData(fields, fileField, fileInput) {
  const fd = new FormData();
  Object.keys(fields || {}).forEach(k => fd.append(k, fields[k]));
  if (fileInput && fileInput.files && fileInput.files[0]) fd.append(fileField, fileInput.files[0]);
  return fd;
}

export async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  try { return await res.json(); } catch (e) { const text = await res.text(); return { success: false, error: text || 'Non-JSON response' }; }
}

export async function postForm(url, fd) {
  const res = await fetch(url, { method: 'POST', body: fd, credentials: 'include' });
  try { return await res.json(); } catch (e) { const text = await res.text(); return { success: false, error: text || 'Non-JSON response' }; }
}
