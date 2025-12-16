import { updateProfile as apiUpdateProfile, getUser } from './api.js';
import { updateUserInfo } from './auth.js';

export async function updateProfile(ctx) {
  const phoneNumber = document.getElementById('phoneNumber')?.value || '';
  const contactMethod = document.getElementById('contactMethod')?.value || '';
  const submitBtn = document.querySelector('#profileForm button[type="submit"]');
  const fileInput = document.getElementById('profileImage');
  const originalText = submitBtn?.innerHTML;
  if (submitBtn) { submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; submitBtn.disabled = true; }
  try {
    const formData = new FormData();
    formData.append('phoneNumber', phoneNumber);
    formData.append('contactMethod', contactMethod);
    if (fileInput && fileInput.files && fileInput.files[0]) formData.append('profileImage', fileInput.files[0]);
    const data = await apiUpdateProfile(formData);
    if (data && data.success) {
      alert('Profile updated successfully!');
      try {
        const res = await getUser();
        if (res && res.ok) { const userData = await res.json(); ctx.currentUser = userData.user; updateUserInfo(ctx); }
      } catch {}
    } else { alert(data?.error || 'Failed to update profile'); }
  } catch { alert('Error updating profile. Please try again.'); }
  finally { if (submitBtn && originalText !== undefined) { submitBtn.innerHTML = originalText; submitBtn.disabled = false; } }
}
