const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.userType === 'compliance') {
      const db = require('../config/database');
      const user = await db('compliance_users').where('id', decoded.userId).whereNull('deleted_at').first();
      if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid or inactive user' });
      req.user = { id: user.id, username: user.name, email: user.email, role: user.role, user_type: 'compliance' };
    } else {
      const userWithRole = await User.findWithRole({ 'users.id': decoded.userId });
      const user = userWithRole[0];
      if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid or inactive user' });
      req.user = { ...user, role: user.role_name?.trim(), user_type: 'main' };
    }

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const requireRole = (roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userWithRole = await User.findWithRole({ 'users.id': req.user.id });
    const userRole = userWithRole[0]?.role_name?.trim();

    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole
};