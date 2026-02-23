const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = '30d'; // 30 days
const JWT_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60; // 30 days in seconds

// Warning if using default secret in production
if (JWT_SECRET === 'your-super-secret-jwt-key' || JWT_SECRET.length < 32) {
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
  const salt = await bcrypt.genSalt(12); // Increased from 10 to 12 for better security
  return bcrypt.hash(password, salt);
};

/**
 * Compare password with hash
 */
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate JWT token with professional claims
 */
const generateToken = (user) => {
  const now = Math.floor(Date.now() / 1000);
  
  return jwt.sign(
    { 
      // Standard claims
      sub: user.id,              // Subject (user ID)
      iat: now,                  // Issued at
      exp: now + JWT_EXPIRES_IN_SECONDS, // Expiration
      jti: generateJti(),        // Unique token ID
      
      // Custom claims
      username: user.username,
      type: 'access'             // Token type
    },
    JWT_SECRET,
    { 
      algorithm: 'HS256'         // Explicit algorithm
    }
  );
};

/**
 * Verify JWT token with detailed error handling
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']      // Only accept HS256
    });
    
    // Additional validation
    if (decoded.type !== 'access') {
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
 * Register a new user
 */
const register = async (username, password) => {
  // Check if username already exists
  const { rows: existingUsers } = await db.query(
    'SELECT id FROM feedback_users WHERE username = $1',
    [username]
  );

  if (existingUsers.length > 0) {
    throw new Error('Username already exists');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Insert user
  const { rows } = await db.query(
    'INSERT INTO feedback_users (username, password) VALUES ($1, $2) RETURNING id, username, created_at',
    [username, hashedPassword]
  );

  const user = rows[0];
  const token = generateToken(user);

  return { user, token };
};

/**
 * Login user
 */
const login = async (username, password) => {
  // Find user
  const { rows } = await db.query(
    'SELECT id, username, password, created_at FROM feedback_users WHERE username = $1',
    [username]
  );

  if (rows.length === 0) {
    throw new Error('Invalid username or password');
  }

  const user = rows[0];

  // Check password
  const isValid = await comparePassword(password, user.password);
  if (!isValid) {
    throw new Error('Invalid username or password');
  }

  // Generate token
  const token = generateToken(user);

  return { 
    user: { 
      id: user.id, 
      username: user.username, 
      created_at: user.created_at 
    }, 
    token 
  };
};

/**
 * Get user from token
 */
const getUserFromToken = async (token) => {
  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }

  // Use 'sub' claim for user ID (standard JWT claim)
  const userId = decoded.sub || decoded.id;
  
  const { rows } = await db.query(
    'SELECT id, username, created_at FROM feedback_users WHERE id = $1',
    [userId]
  );

  return rows[0] || null;
};

/**
 * Middleware to authenticate requests
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const user = await getUserFromToken(token);
  if (!user) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  next();
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const user = await getUserFromToken(token);
    req.user = user;
  }

  next();
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  register,
  login,
  getUserFromToken,
  authenticateToken,
  optionalAuth
};
