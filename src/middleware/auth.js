/**
 * Authentication middleware
 * Provides common authentication functions to validate users and their registration status
 */
const { isRegistered } = require("../models/userModel");
const logger = require("../utils/logger");
const { hashUserId } = require("../utils/cryptoUtils");
const { getUserFromSession } = require("../config/sessionConfig");

/**
 * Middleware to check if a user is authenticated
 */
const isAuthenticated = (req, res, next) => {
  try {
    const sessionIdHeader = req.headers["x-session-id"];
    if (sessionIdHeader) {
      const sessionStore = req.sessionStore;
      sessionStore.get(
        sessionIdHeader,
        (err, session) => {
          req.session = session;
        },
        (err) => {
          logger.error("Session retrieval error:", err);
        },
      );
    }

    // 세션에서 사용자 ID 확인
    const uid = getUserFromSession(req.session);

    if (!uid) {
      logger.warn("Authentication failed - no session found");
      return res.status(401).json({ message: "Not authenticated" });
    }

    // 평문 uid를 요청 객체에 저장
    req.userId = uid;

    // 해시된 uid도 함께 저장 (DB 쿼리용)
    req.hashedUserId = hashUserId(uid);

    // 인증 성공 로그
    logger.info(`User authenticated: ${req.hashedUserId.substring(0, 8)}...`);

    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};

/**
 * Middleware to check if a user is registered
 * Must be used after isAuthenticated middleware
 */
const isUserRegistered = async (req, res, next) => {
  try {
    const registered = await isRegistered(req.userId);
    if (!registered) {
      logger.warn(
        `User not registered: ${req.hashedUserId.substring(0, 8)}...`,
      );
      return res.status(403).json({ message: "Not registered" });
    }
    next();
  } catch (error) {
    logger.error("Error checking registration status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Rate limiting middleware to prevent brute force attacks
 * @param {Object} options - Rate limiting options
 */
const rateLimit = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1 minute
    maxRequests = 100, // 100 requests per minute
    message = "Too many requests, please try again later",
  } = options;

  // Simple in-memory store for rate limiting
  // For production, use Redis or other distributed store
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old requests
    for (const [requestIP, timestamps] of requests.entries()) {
      requests.set(
        requestIP,
        timestamps.filter((time) => time > windowStart),
      );
      if (requests.get(requestIP).length === 0) {
        requests.delete(requestIP);
      }
    }

    // Get or initialize request timestamps for this IP
    const requestTimestamps = requests.get(ip) || [];

    // Check if rate limit is exceeded
    if (requestTimestamps.length >= maxRequests) {
      logger.warn(`Rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({ message });
    }

    // Add current timestamp and store
    requestTimestamps.push(now);
    requests.set(ip, requestTimestamps);

    next();
  };
};

module.exports = {
  isAuthenticated,
  isUserRegistered,
  rateLimit,
};
