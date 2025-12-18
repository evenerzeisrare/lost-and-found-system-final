const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const { uploadsDir } = require('./middlewares/upload');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '..', 'assets')));
app.use('/uploads', express.static(uploadsDir));

app.use(session({
  secret: process.env.SESSION_SECRET || 'csu-bsta-secret',
  resave: true,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' },
  store: new (require('session-memory-store')(session))()
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(require('./routes/pages'));
app.use(require('./routes/auth'));
app.use(require('./routes/users'));
app.use(require('./routes/items'));
app.use(require('./routes/admin'));
app.use(require('./routes/notifications'));
app.use(require('./routes/messages'));
app.use(require('./routes/announcements'));

module.exports = app;
