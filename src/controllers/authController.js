const bcrypt = require('bcryptjs');
const passport = require('passport');
const { pool } = require('../models/db');

async function register(req, res) {
  try {
    const { fullName, studentId, email, password } = req.body;
    if (!email.endsWith('@carsu.edu.ph')) {
      return res.status(400).json({ error: 'Only @carsu.edu.ph emails are allowed for student registration' });
    }
    const connection = await pool().getConnection();
    const [existingUser] = await connection.execute('SELECT * FROM users WHERE email = ? OR student_id = ?', [email, studentId]);
    if (existingUser.length > 0) {
      connection.release();
      return res.status(400).json({ error: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await connection.execute(`INSERT INTO users (full_name, student_id, email, password, role) VALUES (?, ?, ?, ?, 'student')`, [fullName, studentId, email, hashedPassword]);
    connection.release();
    res.json({ success: true, message: 'Registration successful' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

function login(req, res, next) {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    if (!user) {
      return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    }
    req.login(user, err2 => {
      if (err2) {
        return res.status(500).json({ error: 'Login failed' });
      }
      return res.json({
        success: true,
        user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role, student_id: user.student_id, avatar_url: user.avatar_url },
        redirect: user.role === 'admin' ? '/admin-dashboard.html' : '/student-dashboard.html'
      });
    });
  })(req, res, next);
}

function googleAuth(req, res, next) {
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
}

function postGoogleCallback(req, res) {
  if (req.user && req.user.role === 'admin') {
    res.redirect('/admin-dashboard.html');
  } else {
    res.redirect('/student-dashboard.html');
  }
}

function currentUser(req, res) {
  if (req.isAuthenticated()) {
<<<<<<< HEAD
    res.json({ 
      user: { 
        id: req.user.id, 
        full_name: req.user.full_name, 
        email: req.user.email, 
        role: req.user.role, 
        student_id: req.user.student_id, 
        avatar_url: req.user.avatar_url, 
        is_active: req.user.is_active, 
        phone_number: req.user.phone_number,
        college: req.user.college,
        program: req.user.program,
        contact_method: req.user.contact_method 
      } 
    });
=======
    res.json({ user: { id: req.user.id, full_name: req.user.full_name, email: req.user.email, role: req.user.role, student_id: req.user.student_id, avatar_url: req.user.avatar_url, is_active: req.user.is_active, phone_number: req.user.phone_number, contact_method: req.user.contact_method } });
>>>>>>> 2574b52f13985695c0aba54d0b86fa1a207b1c5d
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

function logout(req, res) {
  req.logout(err => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy();
    res.json({ success: true });
  });
}

<<<<<<< HEAD
// NEW: Handle Google profile completion for first-time users
async function completeGoogleProfile(req, res) {
  try {
    const { email, fullname, googleId, avatarUrl, studentId, college, program, phoneNumber } = req.body;
    
    const connection = await pool().getConnection();
    
    // Validate CSU email
    if (!email.endsWith('@carsu.edu.ph')) {
      connection.release();
      return res.status(400).json({ error: 'Only @carsu.edu.ph emails are allowed' });
    }
    
    // Check if user already exists
    const [existing] = await connection.execute(
      'SELECT * FROM users WHERE email = ? OR student_id = ?', 
      [email, studentId]
    );
    
    if (existing.length > 0) {
      connection.release();
      return res.status(400).json({ error: 'User with this email or student ID already exists' });
    }

    // Insert new user with Google credentials
    const [result] = await connection.execute(
      `INSERT INTO users (full_name, email, google_id, avatar_url, student_id, college, program, phone_number, role, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'student', 1)`,
      [fullname, email, googleId, avatarUrl, studentId, college, program, phoneNumber]
    );
    
    // Get the complete user record
    const [newUser] = await connection.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
    connection.release();
    
    // Auto-login the user
    req.login(newUser[0], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Auto-login failed' });
      }
      res.json({ success: true, message: 'Profile completed successfully' });
    });
    
  } catch (error) {
    console.error('Profile completion error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
}

module.exports = { register, login, googleAuth, postGoogleCallback, currentUser, logout, completeGoogleProfile };
=======
module.exports = { register, login, googleAuth, postGoogleCallback, currentUser, logout };
>>>>>>> 2574b52f13985695c0aba54d0b86fa1a207b1c5d
