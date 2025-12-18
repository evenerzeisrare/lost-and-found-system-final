import { updateProfile as apiUpdateProfile, getUser } from './api.js';
import { updateUserInfo } from './auth.js';

export async function updateProfile(ctx) {
  const phoneNumber = document.getElementById('phoneNumber')?.value || '';
  const college = document.getElementById('collegeSelect')?.value || '';
  const program = document.getElementById('programInput')?.value || '';
  const submitBtn = document.querySelector('#profileForm button[type="submit"]');
  const fileInput = document.getElementById('profileImage');
  const messageDiv = document.getElementById('profileMessage');
  const originalText = submitBtn?.innerHTML;
  if (submitBtn) { submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...'; submitBtn.disabled = true; }
  try {
    const phonePattern = /^[0-9+()\-\s]{7,20}$/;
    if (phoneNumber && !phonePattern.test(phoneNumber)) {
      if (messageDiv) { messageDiv.textContent = 'Please enter a valid phone number.'; messageDiv.className = 'message error'; messageDiv.style.display = 'block'; }
      return;
    }
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const isImage = /(jpg|jpeg|png|gif)$/i.test(file.name);
      if (!isImage) { if (messageDiv) { messageDiv.textContent = 'Only image files are allowed (JPG, PNG, GIF).'; messageDiv.className = 'message error'; messageDiv.style.display = 'block'; } return; }
      if (file.size > 5 * 1024 * 1024) { if (messageDiv) { messageDiv.textContent = 'File size too large. Maximum is 5MB.'; messageDiv.className = 'message error'; messageDiv.style.display = 'block'; } return; }
    }
    const formData = new FormData();
    formData.append('phoneNumber', phoneNumber);
    if (college) formData.append('college', college);
    if (program) formData.append('program', program);
    if (fileInput && fileInput.files && fileInput.files[0]) formData.append('profileImage', fileInput.files[0]);
    const data = await apiUpdateProfile(formData);
    if (data && data.success) {
      if (messageDiv) { messageDiv.textContent = 'Profile updated successfully!'; messageDiv.className = 'message success'; messageDiv.style.display = 'block'; }
      try {
        const res = await getUser();
        if (res && res.ok) { const userData = await res.json(); ctx.currentUser = userData.user; updateUserInfo(ctx); }
      } catch {}
    } else { if (messageDiv) { messageDiv.textContent = data?.error || 'Failed to update profile'; messageDiv.className = 'message error'; messageDiv.style.display = 'block'; } }
  } catch (e) { if (messageDiv) { messageDiv.textContent = 'Error updating profile. Please try again.'; messageDiv.className = 'message error'; messageDiv.style.display = 'block'; } }
  finally { if (submitBtn && originalText !== undefined) { submitBtn.innerHTML = originalText; submitBtn.disabled = false; } }
}
