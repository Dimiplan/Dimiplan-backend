/**
 * Database utility functions
 * Provides common database operations to standardize error handling and transactions
 */
const db = require("../config/db");

/**
 * Execute a database transaction safely with proper error handling
 * @param {Function} transactionFn - Function containing transaction operations
 * @returns {Promise} - Result of the transaction
 */
const executeTransaction = async (transactionFn) => {
  try {
    return await db.transaction(transactionFn);
  } catch (error) {
    console.error("Database transaction error:", error);
    throw error;
  }
};

/**
 * Get the next available ID for a user and update the counter
 * @param {string} uid - User ID
 * @param {string} idType - Type of ID (plannerId, planId, roomId, chatId)
 * @returns {Promise<number>} - The next available ID
 */
const getNextId = async (uid, idType) => {
  try {
    // First, ensure user exists in the userid table
    const userData = await db("userid")
      .where({ owner: uid })
      .select(idType)
      .first();

    if (!userData) {
      // Initialize user if not exists
      await db("userid").insert({
        owner: uid,
        plannerId: 1,
        planId: 1,
        roomId: 1,
        chatId: 1,
      });
      return 1;
    }

    const currentId = userData[idType];

    // Update to next ID
    await db("userid")
      .where({ owner: uid })
      .update({ [idType]: currentId + 1 });

    return currentId;
  } catch (error) {
    console.error(`Error getting next ${idType}:`, error);
    throw error;
  }
};

module.exports = {
  executeTransaction,
  getNextId,
};
