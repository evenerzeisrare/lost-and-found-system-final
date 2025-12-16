import { getBrowseItems, getMyItems, getItemById, reportItem, updateItemStatus as apiUpdateItemStatus, updateItem as apiUpdateItem, deleteItem as apiDeleteItem, submitClaimProof as apiSubmitClaimProof } from './api.js';
import { renderItems } from './ui.js';

export async function loadBrowseItems(ctx) {
  try {
    const data = await getBrowseItems();
    if (data && data.success) { ctx.browseItems = data.items; filterBrowseItems(ctx); }
  } catch {}
}

export async function loadMyItems(ctx, filter = 'all') {
  try {
    const data = await getMyItems();
    if (data && data.success) {
      let filteredItems = data.items;
      if (filter === 'pending') filteredItems = data.items.filter(item => item.status === 'pending');
      else if (filter === 'claimed') filteredItems = data.items.filter(item => item.status === 'claimed');
      const containerId = `myItemsGrid${filter.charAt(0).toUpperCase() + filter.slice(1)}`;
      renderItems(ctx, filteredItems, containerId);
    }
  } catch {}
}

export function filterBrowseItems(ctx) {
  if (!ctx.browseItems) return;
  const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
  const category = document.getElementById('categoryFilter')?.value || 'all';
  const status = document.getElementById('statusFilter')?.value || 'all';
  const filtered = ctx.browseItems.filter(item => {
    const matchesSearch = !searchTerm ||
      (item.item_name || '').toLowerCase().includes(searchTerm) ||
      (item.description || '').toLowerCase().includes(searchTerm) ||
      (item.place || '').toLowerCase().includes(searchTerm);
    const matchesCategory = category === 'all' || item.category === category;
    const matchesStatus = status === 'all' || item.status === status;
    return matchesSearch && matchesCategory && matchesStatus;
  });
  renderItems(ctx, filtered, 'browseItemsGrid');
}

export async function fetchItemById(ctx, itemId) {
  try {
    const data = await getItemById(itemId);
    if (data && data.success) return data.item;
  } catch {}
  return null;
}

export function showReportModal(ctx, type) {
  const modal = document.getElementById('reportModal');
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = type === 'lost' ? 'Report Lost Item' : 'Report Found Item';
  modal?.setAttribute('data-report-type', type);
  const dateInput = document.getElementById('itemDate'); if (dateInput) dateInput.valueAsDate = new Date();
  document.getElementById('reportForm')?.reset();
  const imgPrev = document.getElementById('imagePreview'); if (imgPrev) imgPrev.style.display = 'none';
  if (modal) modal.style.display = 'flex';
}

export function hideReportModal() {
  const modal = document.getElementById('reportModal'); if (modal) modal.style.display = 'none';
  document.getElementById('reportForm')?.reset();
  const imgPrev = document.getElementById('imagePreview'); if (imgPrev) imgPrev.style.display = 'none';
  const imgInput = document.getElementById('itemImage'); if (imgInput) imgInput.value = '';
}

export async function submitReport(ctx) {
  const form = document.getElementById('reportForm');
  const modal = document.getElementById('reportModal');
  const type = modal?.getAttribute('data-report-type');
  const submitBtn = document.getElementById('submitReport');
  if (!form?.checkValidity?.()) { form?.reportValidity?.(); return; }
  const formData = new FormData();
  formData.append('itemName', document.getElementById('itemName')?.value || '');
  formData.append('category', document.getElementById('itemCategory')?.value || '');
  formData.append('description', document.getElementById('itemDescription')?.value || '');
  formData.append('place', document.getElementById('itemPlace')?.value || '');
  formData.append('dateLostFound', document.getElementById('itemDate')?.value || '');
  formData.append('status', type || 'lost');
  formData.append('contactInfo', document.getElementById('contactInfo')?.value || '');
  const imageFile = document.getElementById('itemImage')?.files?.[0]; if (imageFile) formData.append('itemImage', imageFile);
  const originalText = submitBtn?.innerHTML; if (submitBtn) { submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...'; submitBtn.disabled = true; }
  try {
    const data = await reportItem(formData);
    if (data && data.success) { alert('Item reported successfully!'); hideReportModal(); await ctx.handlers.loadDashboardData(ctx); await loadMyItems(ctx, 'all'); }
    else { alert(data?.error || 'Failed to report item'); }
  } catch { alert('Error reporting item. Please try again.'); }
  finally { if (submitBtn && originalText !== undefined) { submitBtn.innerHTML = originalText; submitBtn.disabled = false; } }
}

export function showItemDetail(ctx, item) {
  const modal = document.getElementById('itemDetailModal');
  const n = document.getElementById('detailName'); if (n) n.textContent = item.item_name;
  const c = document.getElementById('detailCategory'); if (c) c.textContent = item.category;
  const p = document.getElementById('detailPlace'); if (p) p.textContent = item.place;
  const d = document.getElementById('detailDate'); if (d) d.textContent = new Date(item.created_at).toLocaleDateString();
  const r = document.getElementById('detailReporter'); if (r) r.textContent = item.reporter_name || 'Anonymous';
  const desc = document.getElementById('detailDescription'); if (desc) desc.textContent = item.description;
  const contact = document.getElementById('detailContact'); if (contact) contact.textContent = item.contact_info;
  const statusElement = document.getElementById('detailStatus');
  if (statusElement) { statusElement.textContent = item.status.charAt(0).toUpperCase() + item.status.slice(1); statusElement.className = 'status-badge'; statusElement.classList.add(`status-${item.status}`); }
  const img = document.getElementById('detailImage');
  if (img && img instanceof HTMLImageElement) {
    img.src = item.image_url || (item.image_base64 ? `data:image/jpeg;base64,${item.image_base64}` : null) || 'https://via.placeholder.com/400x300/3CB371/FFFFFF?text=No+Image';
  }
  modal?.setAttribute('data-item-id', String(item.id));
  modal?.setAttribute('data-reporter-id', String(item.reported_by));
  modal?.setAttribute('data-item-name', item.item_name);
  modal?.setAttribute('data-reporter-name', item.reporter_name || 'Owner');
  const messageBtn = document.getElementById('sendMessageBtn');
  const proofBtn = document.getElementById('submitClaimProofBtn');
  const claimNotice = document.getElementById('claimRequirementNotice');
  if (item.status === 'found' && item.reported_by !== ctx.currentUser?.id) { if (claimNotice) { claimNotice.style.display = 'block'; claimNotice.textContent = 'Submit image proof so the owner of the item can verify ownership.'; } }
  else { if (claimNotice) claimNotice.style.display = 'none'; }
  if (messageBtn) messageBtn.style.display = item.reported_by !== ctx.currentUser?.id ? 'inline-block' : 'none';
  if (proofBtn) proofBtn.style.display = item.reported_by !== ctx.currentUser?.id ? 'inline-block' : 'none';
  const markClaimedBtn = document.getElementById('markClaimedByOwnerBtn');
  const markReturnedBtn = document.getElementById('markReturnedByOwnerBtn');
  if (item.reported_by === ctx.currentUser?.id) {
    if (markClaimedBtn) markClaimedBtn.style.display = 'inline-block';
    if (markReturnedBtn) markReturnedBtn.style.display = 'inline-block';
    if (markClaimedBtn) markClaimedBtn.onclick = () => updateItemStatus(ctx, item.id, 'claimed');
    if (markReturnedBtn) markReturnedBtn.onclick = () => updateItemStatus(ctx, item.id, 'returned');
  } else {
    if (markClaimedBtn) markClaimedBtn.style.display = 'none';
    if (markReturnedBtn) markReturnedBtn.style.display = 'none';
  }
  if (modal) modal.style.display = 'flex';
}

export function hideItemDetailModal() { const m = document.getElementById('itemDetailModal'); if (m) m.style.display = 'none'; }

export async function showClaimProofModal() {
  const itemId = document.getElementById('itemDetailModal')?.getAttribute('data-item-id');
  const modal = document.getElementById('claimProofModal');
  const field = document.getElementById('claimProofItemId'); if (field) field.value = itemId || '';
  if (modal) modal.style.display = 'flex';
}

export function hideClaimProofModal() { const m = document.getElementById('claimProofModal'); if (m) m.style.display = 'none'; }

export async function submitClaimProof(ctx) {
  const itemId = document.getElementById('claimProofItemId')?.value;
  const note = document.getElementById('claimProofNote')?.value?.trim() || '';
  const file = document.getElementById('claimProofFile')?.files?.[0] || null;
  if (!file) { alert('Please attach an image proof before submitting.'); return; }
  const fd = new FormData(); if (note) fd.append('note', note); fd.append('proof', file);
  try {
    const data = await apiSubmitClaimProof(itemId, fd);
    if (data && data.success) {
      alert('Claim proof submitted');
      const modal = document.getElementById('claimProofModal'); if (modal) modal.style.display = 'none';
      const detailModal = document.getElementById('itemDetailModal');
      if (detailModal && detailModal.style.display === 'flex') { const notice = document.getElementById('claimRequirementNotice'); if (notice) notice.style.display = 'none'; }
    } else { alert(data?.error || 'Failed to submit proof'); }
  } catch { alert('Error submitting proof'); }
}

export async function updateItemStatus(ctx, itemId, status) {
  try {
    const data = await apiUpdateItemStatus(itemId, status);
    if (data && data.success) { alert(`Status updated to ${status}`); hideItemDetailModal(); await loadMyItems(ctx, 'all'); }
    else { alert(data?.error || 'Failed to update status'); }
  } catch { alert('Error updating status'); }
}

export function showEditItemModal(ctx, item) {
  const modal = document.getElementById('editItemModal');
  document.getElementById('editItemId')?.setAttribute('value', String(item.id));
  const name = document.getElementById('editItemName'); if (name) name.value = item.item_name;
  const cat = document.getElementById('editItemCategory'); if (cat) cat.value = item.category;
  const desc = document.getElementById('editItemDescription'); if (desc) desc.value = item.description || '';
  const place = document.getElementById('editItemPlace'); if (place) place.value = item.place || '';
  const date = document.getElementById('editItemDate'); if (date) date.value = item.date_lost_found ? item.date_lost_found.split('T')[0] : '';
  const status = document.getElementById('editItemStatus'); if (status) status.value = item.status;
  const contact = document.getElementById('editContactInfo'); if (contact) contact.value = item.contact_info || '';
  const img = document.getElementById('editItemImage'); if (img) img.value = '';
  if (modal) modal.style.display = 'flex';
}

export function hideEditItemModal() { const m = document.getElementById('editItemModal'); if (m) m.style.display = 'none'; }

export async function submitEditItem(ctx) {
  const fd = new FormData();
  const itemId = document.getElementById('editItemId')?.value;
  fd.append('itemName', document.getElementById('editItemName')?.value || '');
  fd.append('category', document.getElementById('editItemCategory')?.value || '');
  fd.append('description', document.getElementById('editItemDescription')?.value || '');
  fd.append('place', document.getElementById('editItemPlace')?.value || '');
  fd.append('dateLostFound', document.getElementById('editItemDate')?.value || '');
  fd.append('status', document.getElementById('editItemStatus')?.value || '');
  fd.append('contactInfo', document.getElementById('editContactInfo')?.value || '');
  const image = document.getElementById('editItemImage')?.files?.[0]; if (image) fd.append('itemImage', image);
  try {
    const data = await apiUpdateItem(itemId, fd);
    if (data && data.success) { alert('Item updated successfully'); const m = document.getElementById('editItemModal'); if (m) m.style.display = 'none'; await loadMyItems(ctx, 'all'); }
    else { alert(data?.error || 'Failed to update item'); }
  } catch { alert('Error updating item'); }
}

export async function deleteItem(ctx, itemId) {
  try {
    const data = await apiDeleteItem(itemId);
    if (data && data.success) { alert('Item deleted'); await loadMyItems(ctx, 'all'); }
    else { alert(data?.error || 'Failed to delete item'); }
  } catch { alert('Error deleting item'); }
}
