const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const { pool } = require('../models/db');

passport.use('local', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const connection = await pool().getConnection();
    const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
    connection.release();
    if (rows.length === 0) {
      return done(null, false, { message: 'Invalid account. Please register using your CSU email.' });
    }
    const user = rows[0];
    if (user.role !== 'admin' && !email.endsWith('@carsu.edu.ph')) {
      return done(null, false, { message: 'Please use a valid @carsu.edu.ph email address' });
    }
    if (!user.is_active) {
      return done(null, false, { message: 'This account has been disabled by the administrator. Please use Google Sign-In if applicable or contact the admin for assistance.' });
    }
    if (!user.password) {
      return done(null, false, { message: 'Please use Google Sign-In for this account or contact admin.' });
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return done(null, false, { message: 'Incorrect email or password.' });
    }
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const connection = await pool().getConnection();
    const email = profile.emails[0].value;
<<<<<<< HEAD
    
    if (!email.endsWith('@carsu.edu.ph') && email !== 'lostfound.devteam@gmail.com') {
      connection.release();
      return done(null, false, { message: 'Only CSU email addresses (@carsu.edu.ph) are allowed.' });
    }
    
    const [existingUser] = await connection.execute(
      'SELECT * FROM users WHERE google_id = ? OR email = ?', 
      [profile.id, email]
    );
    
    if (existingUser.length > 0) {
      await connection.execute(
        'UPDATE users SET google_id = ? WHERE id = ?',
        [profile.id, existingUser[0].id]
      );
      connection.release();
      return done(null, existingUser[0]);
    }
    
    // NEW USER - Return temporary profile for completion
    if (email === 'lostfound.devteam@gmail.com') {
      // Auto-create admin
=======
    if (!email.endsWith('@carsu.edu.ph') && email !== 'lostfound.devteam@gmail.com') {
      connection.release();
      return done(null, false, { message: 'Only CSU email addresses (@carsu.edu.ph) are allowed for students. Admins must use the designated admin email.' });
    }
    const [existingUser] = await connection.execute('SELECT * FROM users WHERE google_id = ? OR email = ?', [profile.id, email]);
    if (existingUser.length > 0) {
      await connection.execute('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?', [profile.id, profile.photos[0]?.value, existingUser[0].id]);
      connection.release();
      return done(null, existingUser[0]);
    }
    if (email === 'lostfound.devteam@gmail.com') {
>>>>>>> 2574b52f13985695c0aba54d0b86fa1a207b1c5d
      const [result] = await connection.execute(
        `INSERT INTO users (full_name, email, google_id, avatar_url, role) VALUES (?, ?, ?, ?, 'admin')`,
        [profile.displayName, email, profile.id, profile.photos[0]?.value]
      );
      const [newUser] = await connection.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
      connection.release();
      return done(null, newUser[0]);
<<<<<<< HEAD
    }
    
    // Student - Return temp data for completion (don't save yet)
    connection.release();
    return done(null, {
      is_new_user: true,
      google_id: profile.id,
      full_name: profile.displayName,
      email: email,
      avatar_url: profile.photos[0]?.value,
      role: 'student'
    });
    
=======
    } else {
      connection.release();
      return done(null, false, { message: 'Please register before logging in.' });
    }
>>>>>>> 2574b52f13985695c0aba54d0b86fa1a207b1c5d
  } catch (error) {
    return done(error);
  }
}));

<<<<<<< HEAD

=======
>>>>>>> 2574b52f13985695c0aba54d0b86fa1a207b1c5d
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const connection = await pool().getConnection();
<<<<<<< HEAD
    const [rows] = await connection.execute(
      'SELECT id, full_name, email, student_id, role, avatar_url, is_active, phone_number, college, program, contact_method FROM users WHERE id = ?', 
      [id]
    );
=======
    const [rows] = await connection.execute('SELECT id, full_name, email, student_id, role, avatar_url, is_active FROM users WHERE id = ?', [id]);
>>>>>>> 2574b52f13985695c0aba54d0b86fa1a207b1c5d
    connection.release();
    if (rows.length === 0) {
      return done(null, false);
    }
    done(null, rows[0]);
  } catch (error) {
    done(error);
  }
});

module.exports = {};
