/**
 * Session configuration
 * Provides secure session configuration settings
 */
const { generateSecureToken } = require("../utils/cryptoUtils");

require("./dotenv"); // Load environment variables
// Session secret should be environment variable in production
const SESSION_SECRET = process.env.SESSION_SECRET || generateSecureToken();

// Maximum session age in milliseconds (default: 24 hours)
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE || 86400000, 10);

/**
 * Configure memory-based session store
 * Note: For production with multiple servers, consider using Redis
 * @returns {Object} Session configuration object
 */
const getSessionConfig = () => {
  return {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "dimiplan.sid",
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: SESSION_MAX_AGE,
    },
  };
};

/**
 * Store plain user ID in session
 * @param {Object} session - Session object
 * @param {string} userId - Plain user ID to store
 */
const storeUserInSession = (session, userId) => {
  // Only store the plain user ID in session
  if (!session.passport) {
    session.passport = {};
  }
  session.passport.user = { id: userId };
};

/**
 * Get user ID from session
 * @param {Object} session - Session object
 * @returns {string|null} - User ID or null if not found
 */
const getUserFromSession = (session) => {
  return session?.passport?.user?.id || null;
};

module.exports = {
  getSessionConfig,
  storeUserInSession,
  getUserFromSession,
};
