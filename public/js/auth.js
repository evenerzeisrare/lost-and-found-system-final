// Auth Check JavaScript
class AuthCheck {
    constructor() {
        this.init();
    }
    
    async init() {
        await this.checkAuthStatus();
    }
    
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/user');
            const data = await response.json();
            
            if (data.user) {
                // User is logged in
                console.log('User logged in:', data.user);
                
                // Redirect based on role
                const currentPage = window.location.pathname;
                
                if (data.user.role === 'admin' && !currentPage.includes('admin-dashboard')) {
                    // Admin trying to access non-admin page
                    window.location.href = '/admin-dashboard.html';
                } else if (data.user.role === 'student' && !currentPage.includes('student-dashboard')) {
                    // Student trying to access non-student page
                    window.location.href = '/student-dashboard.html';
                }
                
                // Update UI with user info
                this.updateUserInfo(data.user);
            } else {
                // User not logged in
                console.log('User not logged in');
                
                // If on protected page, redirect to login
                const protectedPages = ['student-dashboard.html', 'admin-dashboard.html'];
                const currentPage = window.location.pathname;
                
                if (protectedPages.some(page => currentPage.includes(page))) {
                    window.location.href = '/login.html';
                }
            }
        } catch (error) {
            console.error('Auth check error:', error);
            
            // If error and on protected page, redirect to login
            const protectedPages = ['student-dashboard.html', 'admin-dashboard.html'];
            const currentPage = window.location.pathname;
            
            if (protectedPages.some(page => currentPage.includes(page))) {
                window.location.href = '/login.html';
            }
        }
    }
    
    updateUserInfo(user) {
        // Update user info in UI if elements exist
        const userNameElements = document.querySelectorAll('.user-name, .admin-name');
        const userAvatarElements = document.querySelectorAll('.user-avatar, .admin-avatar');
        
        userNameElements.forEach(el => {
            if (el) el.textContent = user.full_name || user.email;
        });
        
        userAvatarElements.forEach(el => {
            if (el) {
                if (user.avatar_url) {
                    el.innerHTML = `<img src="${user.avatar_url}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%;">`;
                } else {
                    el.textContent = user.full_name?.charAt(0)?.toUpperCase() || 'U';
                }
            }
        });
    }
    
    async logout() {
        try {
            const response = await fetch('/api/logout');
            const data = await response.json();
            
            if (data.success) {
                window.location.href = '/login.html';
            } else {
                console.error('Logout failed:', data.error);
            }
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/login.html';
        }
    }
}

// Initialize auth check on page load
document.addEventListener('DOMContentLoaded', () => {
    window.authCheck = new AuthCheck();
});