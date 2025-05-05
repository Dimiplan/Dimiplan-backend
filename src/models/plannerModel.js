/**
 * Planner model
 * Handles all planner-related database operations with encryption
 */
const db = require("../config/db");
const { getNextId, executeTransaction } = require("../utils/dbUtils");
const {
  hashUserId,
  encryptData,
  decryptData,
  getTimestamp,
} = require("../utils/cryptoUtils");
const logger = require("../utils/logger");

/**
 * Create a new planner
 * @param {string} uid - User ID
 * @param {string} name - Planner name
 * @param {number} isDaily - Whether the planner is daily (0 or 1)
 * @returns {Promise<Object>} - Created planner data
 */
const createPlanner = async (uid, name, isDaily) => {
  try {
    // Hash the user ID for database queries
    const hashedUid = hashUserId(uid);

    // Check if same planner name exists
    const existingPlanner = await db("planner")
      .where({
        owner: hashedUid,
        name: encryptData(uid, name), // Check for encrypted name
      })
      .first();

    if (existingPlanner) {
      throw new Error("Planner with same name already exists");
    }

    // Get next planner ID
    const plannerId = await getNextId(hashedUid, "plannerId");

    // Create planner with encrypted name
    await db("planner").insert({
      owner: hashedUid,
      name: encryptData(uid, name),
      id: plannerId,
      isDaily: isDaily ?? 0,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    });

    return {
      owner: uid, // Return plain user ID for application logic
      name: name, // Return decrypted name
      id: plannerId,
      isDaily: isDaily ?? 0,
    };
  } catch (error) {
    logger.error("Error creating planner:", error);
    throw error;
  }
};

/**
 * Get a planner by ID
 * @param {string} uid - User ID
 * @param {number} id - Planner ID
 * @returns {Promise<Object|null>} - Planner data or null if not found
 */
const getPlannerById = async (uid, id) => {
  try {
    // Hash the user ID for database queries
    const hashedUid = hashUserId(uid);

    // Get encrypted planner data
    const planner = await db("planner")
      .where({ owner: hashedUid, id: id })
      .first();

    if (!planner) {
      return null;
    }

    // Decrypt name field
    return {
      ...planner,
      owner: uid, // Return original ID for application logic
      name: decryptData(uid, planner.name),
    };
  } catch (error) {
    logger.error("Error getting planner by ID:", error);
    throw error;
  }
};

/**
 * Get all planner
 * @param {string} uid - User ID
 * @returns {Promise<Array>} - Array of planner objects
 */
const getPlanners = async (uid) => {
  try {
    // Hash the user ID for database queries
    const hashedUid = hashUserId(uid);

    // Get encrypted planner data
    const planners = await db("planner")
      .where({ owner: hashedUid })
      .orderByRaw("isDaily ASC, id ASC");

    // Decrypt names in results
    return planners.map((planner) => ({
      ...planner,
      owner: uid, // Return original user ID for application logic
      name: decryptData(uid, planner.name),
    }));
  } catch (error) {
    logger.error("Error getting planners :", error);
    throw error;
  }
};

/**
 * Rename a planner
 * @param {string} uid - User ID
 * @param {number} id - Planner ID
 * @param {string} newName - New planner name
 * @returns {Promise<Object>} - Updated planner data
 */
const renamePlanner = async (uid, id, newName) => {
  try {
    // Hash user ID for database queries
    const hashedUid = hashUserId(uid);

    // Get planner
    const planner = await db("planner")
      .where({ owner: hashedUid, id: id })
      .first();

    if (!planner) {
      throw new Error("Planner not found");
    }

    // Check if new name conflicts with existing planner
    const existingPlanner = await db("planner")
      .where({
        owner: hashedUid,
        name: encryptData(uid, newName),
      })
      .whereNot({ id: id })
      .first();

    if (existingPlanner) {
      throw new Error("Planner with same name already exists");
    }

    // Update with encrypted name
    await db("planner")
      .where({ owner: hashedUid, id: id })
      .update({
        name: encryptData(uid, newName),
        updated_at: getTimestamp(),
      });

    // Return updated planner with decrypted name
    return {
      ...planner,
      owner: uid, // Original user ID for application logic
      name: newName, // Decrypted name
    };
  } catch (error) {
    logger.error("Error renaming planner:", error);
    throw error;
  }
};

/**
 * Delete a planner and all its plans
 * @param {string} uid - User ID
 * @param {number} id - Planner ID
 * @returns {Promise<boolean>} - Success status
 */
const deletePlanner = async (uid, id) => {
  try {
    // Hash user ID for database operations
    const hashedUid = hashUserId(uid);

    // Verify planner exists
    const planner = await db("planner")
      .where({ owner: hashedUid, id: id })
      .first();

    if (!planner) {
      throw new Error("Planner not found");
    }

    // Use transaction to ensure all operations succeed or fail together
    await executeTransaction(async (trx) => {
      // Delete all plans in the planner
      await trx("plan").where({ owner: hashedUid, from: id }).del();

      // Delete the planner
      await trx("planner").where({ owner: hashedUid, id: id }).del();
    });

    logger.info(
      `Planner deleted: ID ${id} by user ${hashedUid.substring(0, 8)}...`,
    );
    return true;
  } catch (error) {
    logger.error("Error deleting planner:", error);
    throw error;
  }
};

module.exports = {
  createPlanner,
  getPlannerById,
  getPlanners,
  renamePlanner,
  deletePlanner,
};
