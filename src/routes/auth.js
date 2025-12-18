const express = require('express');
const router = express.Router();
const passport = require('passport');
const { register, login, googleAuth, postGoogleCallback, currentUser, logout, completeGoogleProfile } = require('../controllers/authController');

router.post('/api/register', register);
router.post('/api/login', login);
router.get('/auth/google', googleAuth);

router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      return res.redirect('/login.html?error=' + encodeURIComponent('Login failed'));
    }
    if (!user) {
      const msg = info?.message || 'Authentication failed';
      return res.redirect('/login.html?error=' + encodeURIComponent(msg));
    }
    if (user.is_new_user) {
      const params = new URLSearchParams({
        googleId: user.google_id,
        email: user.email,
        name: user.full_name,
        avatar: user.avatar_url || ''
      });
      return res.redirect(`/complete-profile.html?${params}`);
    }
    req.logIn(user, err2 => {
      if (err2) {
        return res.redirect('/login.html?error=' + encodeURIComponent('Login failed'));
      }
      if (user.role === 'admin') {
        return res.redirect('/admin-dashboard.html');
      }
      return res.redirect('/student-dashboard.html');
    });
  })(req, res, next);
});

router.get('/api/user', currentUser);
router.get('/api/logout', logout);
router.post('/api/auth/complete-google', completeGoogleProfile);

module.exports = router;
