export function el(id) { return document.getElementById(id); }
export function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }
export function openModal(id) { const m = el(id); if (m) m.style.display = 'flex'; }
export function closeModal(id) { const m = el(id); if (m) m.style.display = 'none'; }
export function clearInput(id) { const e = el(id); if (e) e.value = ''; }
export function buildFormData(fields = {}, fileField, fileInput) {
  const fd = new FormData();
  Object.keys(fields).forEach(k => fd.append(k, fields[k]));
  if (fileInput && fileInput.files && fileInput.files[0]) fd.append(fileField, fileInput.files[0]);
  return fd;
}
export async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  try { return await res.json(); } catch (e) { const text = await res.text(); return { success: false, error: text || 'Non-JSON response' }; }
}
export async function postForm(url, fd, options = {}) {
  const res = await fetch(url, { method: 'POST', body: fd, credentials: 'include', ...options });
  try { return await res.json(); } catch (e) { const text = await res.text(); return { success: false, error: text || 'Non-JSON response' }; }
}
