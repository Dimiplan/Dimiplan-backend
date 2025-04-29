/**
 * User model
 * Handles all user-related database operations
 */
const db = require("../config/db");

/**
 * Check if a user exists in the database
 * @param {string} uid - User ID
 * @returns {Promise<boolean>} - True if user exists
 */
const isUserExists = async (uid) => {
  try {
    const count = await db("users").where("id", uid).count("* as count");
    return parseInt(count[0].count, 10) > 0;
  } catch (error) {
    console.error("Error checking if user exists:", error);
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
      await db("users").insert(user);

      // Initialize userId table for the new user
      await db("userid").insert({
        owner: user.id,
        folderId: 1,
        plannerId: 1,
        planId: 1,
        roomId: 1,
        chatId: 1,
      });

      // Create root folder for the new user
      await db("folders").insert({
        owner: user.id,
        name: "Root",
        id: 0,
        from: -1,
      });
    }
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
};

/**
 * Get a user by their ID
 * @param {string} uid - User ID
 * @returns {Promise<Object|null>} - User object or null if not found
 */
const getUser = async (uid) => {
  try {
    const users = await db("users").where("id", uid).select("*");
    return users[0] || null;
  } catch (error) {
    console.error("Error getting user:", error);
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
    return await db("users").where("id", uid).update(userData);
  } catch (error) {
    console.error("Error updating user:", error);
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
    console.error("Error checking if user is registered:", error);
    throw error;
  }
};

module.exports = {
  isUserExists,
  createUser,
  getUser,
  updateUser,
  isRegistered,
};
