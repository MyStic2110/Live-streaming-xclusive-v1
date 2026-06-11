import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '../config/jwtConfig.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please login.' });
  }

  jwt.verify(token, JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Session expired or invalid token. Please re-authenticate.' });
    }
    req.user = decoded;
    next();
  });
};

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Authentication details missing.' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges for this operation.' });
    }
    
    next();
  };
};

const rateLimitMap = new Map();

// Periodically clean up rate limit map to prevent memory growth (memory leaks)
setInterval(() => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const activeTimestamps = timestamps.filter(t => now - t < windowMs);
    if (activeTimestamps.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, activeTimestamps);
    }
  }
}, 10 * 60 * 1000).unref(); // runs every 10 mins, unref so it does not keep process alive

/**
 * Sliding window rate limiter to protect auth endpoints from brute-force attempts.
 */
export const authRateLimiter = (limit = 10, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    
    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, []);
    }
    
    const timestamps = rateLimitMap.get(ip).filter(t => now - t < windowMs);
    timestamps.push(now);
    rateLimitMap.set(ip, timestamps);
    
    if (timestamps.length > limit) {
      return res.status(429).json({ 
        error: 'Too many authentication attempts. Please try again in 15 minutes.' 
      });
    }
    
    next();
  };
};

