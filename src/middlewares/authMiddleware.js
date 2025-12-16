function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    if (req.user.is_active === false) {
      req.logout(() => {});
      return res.status(403).json({ error: 'Account deactivated' });
    }
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
}

function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'admin' && req.user.is_active !== false) {
    return next();
  }
  res.status(403).json({ error: 'Access denied. Admin only.' });
}

module.exports = { ensureAuthenticated, ensureAdmin };
