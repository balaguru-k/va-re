const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');


const generateToken = (userId, userType = 'main') => {
  return jwt.sign({ userId, userType }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '9h'
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // First check main users table
    const user = await User.findByEmailOrUsername(email);
    if (user) {
      if (!user.is_active) return res.status(401).json({ error: 'Account is inactive' });
      const isValidPassword = await User.verifyPassword(password, user.password);
      if (!isValidPassword) return res.status(401).json({ error: 'Invalid credentials' });

      await User.update(user.id, { last_login: new Date() });
      const userWithRole = await User.findWithRole({ 'users.id': user.id });
      const userData = userWithRole[0];
      const token = generateToken(user.id, 'main');

      return res.json({
        message: 'Login successful',
        token,
        user: { id: userData.id, username: userData.username, email: userData.email, role: userData.role_name, user_type: 'main', is_first_login: !!user.is_first_login }
      });
    }

    // Check compliance_users table
    const db = require('../config/database');
    const complianceUser = await db('compliance_users').where('email', email).whereNull('deleted_at').first();
    if (!complianceUser) return res.status(401).json({ error: 'Invalid credentials' });
    if (!complianceUser.is_active) return res.status(401).json({ error: 'Account is inactive' });

    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, complianceUser.password);
    if (!isValidPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(complianceUser.id, 'compliance');
    return res.json({
      message: 'Login successful',
      token,
      user: { id: complianceUser.id, username: complianceUser.name, email: complianceUser.email, role: complianceUser.role, user_type: 'compliance' }
    });
  } catch (error) {
    logger.error('Login error', { error: error });
    res.status(500).json({ error: 'Login Failed', details: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const userWithRole = await User.findWithRole({ 'users.id': req.user.id });
    const userData = userWithRole[0];

    res.json({
      user: {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.role_name,
        last_login: userData.last_login
      }
    });
  } catch (error) {
    logger.error('Get profile error', { error: error });
    res.status(500).json({ error: 'Failed to fetch User Profile', details: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await User.verifyPassword(currentPassword, user.password);
    if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });

    await User.update(user.id, { password: newPassword });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error', { error });
    res.status(500).json({ error: 'Failed to change password' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    if (!email || !currentPassword || !newPassword) return res.status(400).json({ error: 'All fields are required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = await User.findByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await User.verifyPassword(currentPassword, user.password);
    if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });

    await User.update(user.id, { password: newPassword, is_first_login: false });
    res.json({ message: 'Password reset successfully. Please login with your new password.' });
  } catch (error) {
    logger.error('Reset password error', { error });
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

module.exports = {
  login,
  getProfile,
  changePassword,
  resetPassword
};