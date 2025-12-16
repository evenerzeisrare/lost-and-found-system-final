const express = require('express');
const path = require('path');
const { ensureAuthenticated } = require('../middlewares/authMiddleware');
const router = express.Router();

router.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
});

router.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'login.html'));
});

router.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'register.html'));
});

router.get('/student-dashboard.html', ensureAuthenticated, (req, res) => {
  if (req.user.role !== 'student') {
    return res.redirect('/admin-dashboard.html');
  }
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'student-dashboard.html'));
});

router.get('/admin-dashboard.html', ensureAuthenticated, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/student-dashboard.html');
  }
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin-dashboard.html'));
});

module.exports = router;
