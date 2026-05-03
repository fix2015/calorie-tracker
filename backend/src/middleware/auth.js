const { verifyAccessToken } = require('../utils/jwt');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(header.slice(7));
      req.userId = payload.userId;
    } catch {
      // Ignore invalid tokens for public routes
    }
  }
  next();
}

module.exports = { authenticate, optionalAuth };
