const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

const loginValidation = [
  body('email').notEmpty().withMessage('Email or username is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

const userValidation = [
  body('username').isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role_id').isInt({ min: 1 }).withMessage('Valid role is required'),
  handleValidationErrors
];

const userUpdateValidation = [
  body('username').optional().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role_id').optional().isInt({ min: 1 }).withMessage('Valid role is required'),
  // body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

module.exports = {
  loginValidation,
  userValidation,
  userUpdateValidation,
  handleValidationErrors
};