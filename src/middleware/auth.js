/**
 * Authentication middleware
 * Provides common authentication functions to validate users and their registration status
 */
const { isRegistered } = require("../models/userModel");

/**
 * Middleware to check if a user is authenticated
 */
const isAuthenticated = (req, res, next) => {
  const uid = req.session?.passport?.user?.id;
  if (!uid) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  req.userId = uid; // Add user ID to request object for easy access
  next();
};

/**
 * Middleware to check if a user is registered
 * Must be used after isAuthenticated middleware
 */
const isUserRegistered = async (req, res, next) => {
  try {
    const registered = await isRegistered(req.userId);
    if (!registered) {
      return res.status(403).json({ message: "Not registered" });
    }
    next();
  } catch (error) {
    console.error("Error checking registration status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  isAuthenticated,
  isUserRegistered,
};
