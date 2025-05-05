/**
 * User model
 * Handles all user-related database operations with enhanced security
 */
const db = require("../config/db");
const {
  hashUserId,
  encryptData,
  decryptData,
  getTimestamp,
} = require("../utils/cryptoUtils");
const logger = require("../utils/logger");

/**
 * Check if a user exists in the database
 * @param {string} uid - User ID
 * @returns {Promise<boolean>} - True if user exists
 */
const isUserExists = async (uid) => {
  try {
    const hashedUid = hashUserId(uid);
    const count = await db("users").where("id", hashedUid).count("* as count");
    return parseInt(count[0].count, 10) > 0;
  } catch (error) {
    logger.error("Error checking if user exists:", error);
    throw error;
  }
};

/**
 * Create a new user in the database if they don't already exist
 * @param {Object} user - User object with id, name, grade, class, email, profile_image
 * @returns {Promise} - Result of the database operation
 */
const createUser = async (user) => {
  try {
    if (!(await isUserExists(user.id))) {
      // Encrypt sensitive user data
      const hashedUid = hashUserId(user.id);
      const encryptedUser = {
        id: hashedUid,
        name: user.name ? encryptData(user.id, user.name) : null,
        grade: user.grade,
        class: user.class,
        email: user.email ? encryptData(user.id, user.email) : null,
        profile_image: user.profile_image
          ? encryptData(user.id, user.profile_image)
          : null,
      };

      // Add audit metadata (MySQL 호환 형식)
      const timestamp = getTimestamp();
      encryptedUser.created_at = timestamp;
      encryptedUser.updated_at = timestamp;

      await db("users").insert(encryptedUser);

      // Initialize userId table for the new user
      await db("userid").insert({
        owner: hashedUid,
        plannerId: 1,
        planId: 1,
        roomId: 1,
        chatId: 1,
        created_at: timestamp,
      });

      // Log user creation (without sensitive data)
      logger.info(`User created: ${hashedUid.substring(0, 8)}...`);
    }
  } catch (error) {
    logger.error("Error creating user:", error);
    throw error;
  }
};

/**
 * Get a user by their ID with decrypted information
 * @param {string} uid - User ID
 * @returns {Promise<Object|null>} - User object or null if not found
 */
const getUser = async (uid) => {
  try {
    const hashedUid = hashUserId(uid);
    const users = await db("users").where("id", hashedUid).select("*");

    if (!users[0]) return null;

    // Decrypt user information
    const user = users[0];
    return {
      id: uid, // Return original ID for session use
      name: user.name ? decryptData(uid, user.name) : null,
      grade: user.grade,
      class: user.class,
      email: user.email ? decryptData(uid, user.email) : null,
      profile_image: user.profile_image
        ? decryptData(uid, user.profile_image)
        : null,
    };
  } catch (error) {
    logger.error("Error getting user:", error);
    throw error;
  }
};

/**
 * Update a user's information
 * @param {string} uid - User ID
 * @param {Object} userData - User data to update
 * @returns {Promise} - Result of the database operation
 */
const updateUser = async (uid, userData) => {
  try {
    const hashedUid = hashUserId(uid);

    // Encrypt the data before storing
    const encryptedData = {};

    if (userData.name !== undefined) {
      encryptedData.name = encryptData(uid, userData.name);
    }

    if (userData.email !== undefined) {
      encryptedData.email = encryptData(uid, userData.email);
    }

    if (userData.profile_image !== undefined) {
      encryptedData.profile_image = encryptData(uid, userData.profile_image);
    }

    // Non-encrypted fields
    if (userData.grade !== undefined) {
      encryptedData.grade = userData.grade;
    }

    if (userData.class !== undefined) {
      encryptedData.class = userData.class;
    }

    // Add update timestamp (MySQL 호환 형식)
    encryptedData.updated_at = getTimestamp();

    return await db("users").where("id", hashedUid).update(encryptedData);
  } catch (error) {
    logger.error("Error updating user:", error);
    throw error;
  }
};

/**
 * Check if a user is registered (has name set)
 * @param {string} uid - User ID
 * @returns {Promise<boolean>} - True if user is registered
 */
const isRegistered = async (uid) => {
  try {
    const user = await getUser(uid);
    return user !== null && user.name !== null;
  } catch (error) {
    logger.error("Error checking if user is registered:", error);
    throw error;
  }
};

/**
 * Get hashed user ID from plain user ID
 * @param {string} plainUid - Plain user ID
 * @returns {string} - Hashed user ID
 */
const getHashedUserId = (plainUid) => {
  return hashUserId(plainUid);
};

module.exports = {
  isUserExists,
  createUser,
  getUser,
  updateUser,
  isRegistered,
  getHashedUserId,
};
