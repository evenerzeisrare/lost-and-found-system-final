const express = require('express');
const router = express.Router();
const passport = require('passport');
const { register, login, googleAuth, postGoogleCallback, currentUser, logout } = require('../controllers/authController');

router.post('/api/register', register);
router.post('/api/login', login);
router.get('/auth/google', googleAuth);
router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      return res.redirect('/login.html?error=' + encodeURIComponent('Login failed'));
    }
    if (!user) {
      const msg = info?.message || 'Please register before logging in.';
      return res.redirect('/login.html?error=' + encodeURIComponent(msg));
    }
    req.logIn(user, (err2) => {
      if (err2) return res.redirect('/login.html?error=' + encodeURIComponent('Login failed'));
      if (user.role === 'admin') return res.redirect('/admin-dashboard.html');
      return res.redirect('/student-dashboard.html');
    });
  })(req, res, next);
});
router.get('/api/user', currentUser);
router.get('/api/logout', logout);

module.exports = router;
