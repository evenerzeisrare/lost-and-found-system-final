const express = require('express');
const router = express.Router();
const passport = require('passport');
const { register, login, googleAuth, postGoogleCallback, currentUser, logout } = require('../controllers/authController');

router.post('/api/register', register);
router.post('/api/login', login);
router.get('/auth/google', googleAuth);
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login.html', failureMessage: true }), postGoogleCallback);
router.get('/api/user', currentUser);
router.get('/api/logout', logout);

module.exports = router;
