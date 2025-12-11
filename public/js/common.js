// Common JavaScript functions used across the application

// Format date to readable string
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show loading spinner
function showLoading(element) {
    element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    element.disabled = true;
}

// Hide loading spinner
function hideLoading(element, originalText) {
    element.innerHTML = originalText;
    element.disabled = false;
}

// Show success message
function showSuccess(message) {
    alert(message);
}

// Show error message
function showError(message) {
    alert('Error: ' + message);
}

// Validate email format
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate CSU email
function isValidCSUEmail(email) {
    return email.endsWith('@carsu.edu.ph');
}

// Check if user is authenticated
async function checkAuth() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        return data.user;
    } catch (error) {
        return null;
    }
}

// Redirect if not authenticated
async function requireAuth() {
    const user = await checkAuth();
    if (!user) {
        window.location.href = '/login.html';
        return null;
    }
    return user;
}

// Logout function
async function logout() {
    try {
        await fetch('/api/logout');
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login.html';
    }
}

// Debounce function for search inputs
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get status badge class
function getStatusClass(status) {
    switch(status) {
        case 'pending': return 'status-pending';
        case 'lost': return 'status-lost';
        case 'found': return 'status-found';
        case 'claimed': return 'status-claimed';
        case 'returned': return 'status-returned';
        default: return '';
    }
}

// Get status text
function getStatusText(status) {
    switch(status) {
        case 'pending': return 'Pending';
        case 'lost': return 'Lost';
        case 'found': return 'Found';
        case 'claimed': return 'Claimed';
        case 'returned': return 'Returned';
        default: return status;
    }
}

// Get category display name
function getCategoryName(category) {
    const categories = {
        'gadgets': 'Gadgets',
        'accessories': 'Accessories',
        'ids': 'IDs & Cards',
        'clothing': 'Clothing',
        'books': 'Books',
        'others': 'Others'
    };
    return categories[category] || category;
}

// Create item card HTML
function createItemCard(item, showActions = true) {
    const date = formatDate(item.created_at);
    const statusClass = getStatusClass(item.status);
    const statusText = getStatusText(item.status);
    const categoryName = getCategoryName(item.category);
    
    return `
        <div class="item-card" data-item-id="${item.id}">
            <div class="item-image">
                <img src="${item.image_url || 'https://via.placeholder.com/400x300/3CB371/FFFFFF?text=No+Image'}" 
                     alt="${item.item_name}"
                     onerror="this.src='https://via.placeholder.com/400x300/3CB371/FFFFFF?text=No+Image'">
            </div>
            <div class="item-details">
                <div class="item-title">${item.item_name}</div>
                <div class="item-meta">
                    <span class="item-category">${categoryName}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="item-description">
                    ${item.description || 'No description'}
                </div>
                <div class="item-footer">
                    <small><i class="fas fa-map-marker-alt"></i> ${item.place || 'Unknown'}</small>
                    <small>${date}</small>
                </div>
                ${showActions ? `
                    <div class="item-actions" style="margin-top: 10px;">
                        <button class="btn btn-outline btn-small view-details" data-item-id="${item.id}">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatDate,
        showLoading,
        hideLoading,
        showSuccess,
        showError,
        isValidEmail,
        isValidCSUEmail,
        checkAuth,
        requireAuth,
        logout,
        debounce,
        formatFileSize,
        getStatusClass,
        getStatusText,
        getCategoryName,
        createItemCard
    };
}