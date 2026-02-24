const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');
const mailer = require('./mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60; // 30 days
const VERIFICATION_TOKEN_EXPIRES = 5 * 60; // 5 minutes in seconds
const RESET_TOKEN_EXPIRES = 5 * 60; // 5 minutes in seconds
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Warning if using default secret in production
if (process.env.NODE_ENV === 'production' && (JWT_SECRET === 'your-super-secret-jwt-key' || JWT_SECRET.length < 32)) {
  console.warn('⚠️  WARNING: JWT_SECRET is weak or using default value. Please set a strong secret in production!');
}

/**
 * Generate a unique JWT ID
 */
const generateJti = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Hash password using bcrypt
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

/**
 * Compare password with hash
 */
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate JWT access token
 */
const generateToken = (user) => {
  const now = Math.floor(Date.now() / 1000);
  
  return jwt.sign(
    { 
      sub: user.id,
      iat: now,
      exp: now + JWT_EXPIRES_IN_SECONDS,
      jti: generateJti(),
      username: user.username,
      email: user.email,
      type: 'access'
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
};

/**
 * Generate email verification token (JWT with 5 min expiry)
 * Contains all registration data - no database storage needed
 */
const generateVerificationToken = (username, email, passwordHash) => {
  const now = Math.floor(Date.now() / 1000);
  
  return jwt.sign(
    {
      username,
      email,
      passwordHash,
      iat: now,
      exp: now + VERIFICATION_TOKEN_EXPIRES,
      jti: generateJti(),
      type: 'email_verification'
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
};

/**
 * Generate password reset token (JWT with 5 min expiry)
 * No database storage needed
 */
const generateResetToken = (userId, email) => {
  const now = Math.floor(Date.now() / 1000);
  
  return jwt.sign(
    {
      sub: userId,
      email,
      iat: now,
      exp: now + RESET_TOKEN_EXPIRES,
      jti: generateJti(),
      type: 'password_reset'
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
};

/**
 * Verify JWT token
 */
const verifyToken = (token, expectedType = 'access') => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    });
    
    if (decoded.type !== expectedType) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('Token expired at:', error.expiredAt);
    } else if (error.name === 'JsonWebTokenError') {
      console.log('Invalid token:', error.message);
    }
    return null;
  }
};

/**
 * Register a new user - Step 1: Send verification email
 * Does NOT create user in database yet
 */
const registerUser = async (username, email, password) => {
  // Check if username or email already exists
  const existingUser = await db.query(
    'SELECT id FROM users WHERE username = $1 OR email = $2',
    [username, email]
  );
  
  if (existingUser.rows.length > 0) {
    const existing = await db.query(
      'SELECT username, email FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existing.rows.some(r => r.username === username)) {
      throw new Error('Username already exists');
    }
    if (existing.rows.some(r => r.email === email)) {
      throw new Error('Email already exists');
    }
  }
  
  // Hash password
  const passwordHash = await hashPassword(password);
  
  // Generate verification token (JWT contains all registration data)
  const token = generateVerificationToken(username, email, passwordHash);
  const verifyUrl = BASE_URL + '/verify-email?token=' + token;
  
  // Send verification email
  const html = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">' +
    '<h2 style="color: #333;">Verify Your Email</h2>' +
    '<p>Hi ' + username + ',</p>' +
    '<p>Thank you for registering. Please click the button below to verify your email address:</p>' +
    '<p style="text-align: center; margin: 30px 0;">' +
    '<a href="' + verifyUrl + '" ' +
    'style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email</a>' +
    '</p>' +
    '<p style="color: #666; font-size: 14px;">This link will expire in 5 minutes.</p>' +
    '<p style="color: #666; font-size: 14px;">If you did not create an account, please ignore this email.</p>' +
    '<hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">' +
    '<p style="color: #999; font-size: 12px;">If the button does not work, copy and paste this link into your browser:</p>' +
    '<p style="color: #999; font-size: 12px; word-break: break-all;">' + verifyUrl + '</p>' +
    '</div>';
  
  await mailer.sendEmail(email, 'Verify Your Email Address', html);
  
  // Return pending status (user not created yet)
  return {
    pending: true,
    message: 'Verification email sent. Please check your inbox.',
    email
  };
};

/**
 * Complete registration - Step 2: Verify email and create user
 * Called when user clicks verification link
 */
const completeRegistration = async (token) => {
  // Verify the JWT token
  const decoded = verifyToken(token, 'email_verification');
  
  if (!decoded) {
    throw new Error('Invalid or expired verification link');
  }
  
  const { username, email, passwordHash } = decoded;
  
  // Check again if user was created in the meantime
  const existingUser = await db.query(
    'SELECT id FROM users WHERE username = $1 OR email = $2',
    [username, email]
  );
  
  if (existingUser.rows.length > 0) {
    throw new Error('This account has already been verified or credentials are taken');
  }
  
  // NOW create the user in database
  const result = await db.query(
    'INSERT INTO users (username, email, password_hash, is_verified) VALUES ($1, $2, $3, true) RETURNING id, username, email, created_at',
    [username, email, passwordHash]
  );
  
  const user = result.rows[0];
  
  // Generate access token for immediate login
  const accessToken = generateToken(user);
  
  return {
    success: true,
    message: 'Email verified successfully. Your account has been created.',
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    },
    token: accessToken
  };
};

/**
 * Resend verification email
 * For users who haven't received or verification expired
 */
const resendVerification = async (email, username, password) => {
  // Check if already verified/exists
  const existingUser = await db.query(
    'SELECT id, is_verified FROM users WHERE email = $1',
    [email]
  );
  
  if (existingUser.rows.length > 0) {
    if (existingUser.rows[0].is_verified) {
      throw new Error('This email is already verified. Please login.');
    }
  }
  
  // Re-register (will send new verification email)
  return registerUser(username, email, password);
};

/**
 * Login user
 */
const loginUser = async (usernameOrEmail, password) => {
  // Find user by username or email
  const result = await db.query(
    'SELECT id, username, email, password_hash, is_verified FROM users WHERE username = $1 OR email = $1',
    [usernameOrEmail]
  );
  
  if (result.rows.length === 0) {
    throw new Error('User not found. Please check your username or email.');
  }
  
  const user = result.rows[0];
  
  // Check if verified
  if (!user.is_verified) {
    throw new Error('Please verify your email before logging in');
  }
  
  // Verify password
  const isValidPassword = await comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Incorrect password. Please try again.');
  }
  
  // Generate token
  const token = generateToken(user);
  
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    },
    token
  };
};

/**
 * Get user from token
 */
const getUserFromToken = async (token) => {
  const decoded = verifyToken(token, 'access');
  
  if (!decoded) {
    return null;
  }
  
  // Get fresh user data from database
  const result = await db.query(
    'SELECT id, username, email, created_at FROM users WHERE id = $1',
    [decoded.sub]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0];
};

/**
 * Change password (for logged in users)
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  // Get current password hash
  const result = await db.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  
  // Verify current password
  const isValidPassword = await comparePassword(currentPassword, result.rows[0].password_hash);
  if (!isValidPassword) {
    throw new Error('Current password is incorrect');
  }
  
  // Hash new password and update
  const newPasswordHash = await hashPassword(newPassword);
  await db.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [newPasswordHash, userId]
  );
  
  return { success: true, message: 'Password changed successfully' };
};

/**
 * Request password reset - sends email with JWT token
 */
const requestPasswordReset = async (email) => {
  // Find user by email
  const result = await db.query(
    'SELECT id, username, email FROM users WHERE email = $1 AND is_verified = true',
    [email]
  );
  
  if (result.rows.length === 0) {
    // Don't reveal if email exists
    return { success: true, message: 'If an account exists with this email, a reset link will be sent.' };
  }
  
  const user = result.rows[0];
  
  // Generate reset token (JWT - no database storage)
  const token = generateResetToken(user.id, user.email);
  const resetUrl = BASE_URL + '/reset-password?token=' + token;
  
  // Send reset email
  const html = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">' +
    '<h2 style="color: #333;">Reset Your Password</h2>' +
    '<p>Hi ' + user.username + ',</p>' +
    '<p>You requested to reset your password. Click the button below to create a new password:</p>' +
    '<p style="text-align: center; margin: 30px 0;">' +
    '<a href="' + resetUrl + '" ' +
    'style="display: inline-block; padding: 12px 30px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>' +
    '</p>' +
    '<p style="color: #666; font-size: 14px;">This link will expire in 5 minutes.</p>' +
    '<p style="color: #666; font-size: 14px;">If you did not request a password reset, please ignore this email.</p>' +
    '<hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">' +
    '<p style="color: #999; font-size: 12px;">If the button does not work, copy and paste this link into your browser:</p>' +
    '<p style="color: #999; font-size: 12px; word-break: break-all;">' + resetUrl + '</p>' +
    '</div>';
  
  await mailer.sendEmail(email, 'Reset Your Password', html);
  
  return { success: true, message: 'If an account exists with this email, a reset link will be sent.' };
};

/**
 * Validate reset token
 */
const validateResetToken = async (token) => {
  const decoded = verifyToken(token, 'password_reset');
  
  if (!decoded) {
    return null;
  }
  
  // Verify user still exists
  const result = await db.query(
    'SELECT id, email FROM users WHERE id = $1 AND email = $2',
    [decoded.sub, decoded.email]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return {
    valid: true,
    userId: decoded.sub,
    email: decoded.email
  };
};

/**
 * Complete password reset
 */
const completePasswordReset = async (token, newPassword) => {
  const decoded = verifyToken(token, 'password_reset');
  
  if (!decoded) {
    throw new Error('Invalid or expired reset link');
  }
  
  // Verify user still exists
  const result = await db.query(
    'SELECT id FROM users WHERE id = $1 AND email = $2',
    [decoded.sub, decoded.email]
  );
  
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  
  // Hash new password and update
  const newPasswordHash = await hashPassword(newPassword);
  await db.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [newPasswordHash, decoded.sub]
  );
  
  return { 
    success: true, 
    message: 'Password reset successfully. You can now login with your new password.',
    email: decoded.email 
  };
};

/**
 * Get user's licenses
 */
const getUserLicenses = async (userId) => {
  const result = await db.query(
    `SELECT id, product_name AS "productName", license_key AS "licenseKey", 
            purchased_at AS "purchasedAt", expires_at AS "expiresAt", status 
     FROM licenses 
     WHERE user_id = $1 
     ORDER BY purchased_at DESC`,
    [userId]
  );
  
  return result.rows;
};

/**
 * Express middleware to protect routes
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.split(' ')[1];
  const user = await getUserFromToken(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  req.user = user;
  next();
};

/**
 * Optional auth middleware - doesn't fail if no token
 */
const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const user = await getUserFromToken(token);
    if (user) {
      req.user = user;
    }
  }
  
  next();
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  registerUser,
  completeRegistration,
  resendVerification,
  loginUser,
  getUserFromToken,
  changePassword,
  requestPasswordReset,
  validateResetToken,
  completePasswordReset,
  getUserLicenses,
  authMiddleware,
  optionalAuthMiddleware,
  // Aliases for backward compatibility
  authenticateToken: authMiddleware
};
