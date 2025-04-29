/**
 * Planner model
 * Handles all planner-related database operations
 */
const db = require("../config/db");
const { getNextId, executeTransaction } = require("../utils/dbUtils");

/**
 * Create a new planner
 * @param {string} uid - User ID
 * @param {string} name - Planner name
 * @param {number} isDaily - Whether the planner is daily (0 or 1)
 * @param {number} folderId - Folder ID the planner belongs to
 * @returns {Promise<Object>} - Created planner data
 */
const createPlanner = async (uid, name, isDaily, folderId) => {
  try {
    // Check if folder exists
    const folder = await db("folders")
      .where({ owner: uid, id: folderId })
      .first();

    if (!folder) {
      throw new Error("Folder not found");
    }

    // Check if same planner name exists in the folder
    const existingPlanner = await db("planner")
      .where({ owner: uid, from: folderId, name: name })
      .first();

    if (existingPlanner) {
      throw new Error("Planner with same name already exists in this folder");
    }

    // Get next planner ID
    const plannerId = await getNextId(uid, "plannerId");

    // Create planner
    await db("planner").insert({
      owner: uid,
      name: name,
      id: plannerId,
      from: folderId,
      isDaily: isDaily,
    });

    return {
      owner: uid,
      name: name,
      id: plannerId,
      from: folderId,
      isDaily: isDaily,
    };
  } catch (error) {
    console.error("Error creating planner:", error);
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
    return await db("planner").where({ owner: uid, id: id }).first();
  } catch (error) {
    console.error("Error getting planner by ID:", error);
    throw error;
  }
};

/**
 * Get all planners in a folder
 * @param {string} uid - User ID
 * @param {number} folderId - Folder ID
 * @returns {Promise<Array>} - Array of planner objects
 */
const getPlannersInFolder = async (uid, folderId) => {
  try {
    return await db("planner")
      .where({ owner: uid, from: folderId })
      .orderByRaw("isDaily ASC, id ASC");
  } catch (error) {
    console.error("Error getting planners in folder:", error);
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
    const planner = await getPlannerById(uid, id);

    if (!planner) {
      throw new Error("Planner not found");
    }

    // Check if new name conflicts with existing planner in the same folder
    const existingPlanner = await db("planner")
      .where({ owner: uid, from: planner.from, name: newName })
      .whereNot({ id: id })
      .first();

    if (existingPlanner) {
      throw new Error("Planner with same name already exists in this folder");
    }

    await db("planner").where({ owner: uid, id: id }).update({ name: newName });

    return {
      ...planner,
      name: newName,
    };
  } catch (error) {
    console.error("Error renaming planner:", error);
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
    const planner = await getPlannerById(uid, id);

    if (!planner) {
      throw new Error("Planner not found");
    }

    // Use transaction to ensure all operations succeed or fail together
    await executeTransaction(async (trx) => {
      // Delete all plans in the planner
      await trx("plan").where({ owner: uid, from: id }).del();

      // Delete the planner
      await trx("planner").where({ owner: uid, id: id }).del();
    });

    return true;
  } catch (error) {
    console.error("Error deleting planner:", error);
    throw error;
  }
};

module.exports = {
  createPlanner,
  getPlannerById,
  getPlannersInFolder,
  renamePlanner,
  deletePlanner,
};
