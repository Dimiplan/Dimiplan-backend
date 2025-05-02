/**
 * Plan model
 * Handles all plan-related database operations with encryption
 */
const db = require("../config/db");
const { getNextId } = require("../utils/dbUtils");
const {
  hashUserId,
  encryptData,
  decryptData,
  getTimestamp,
} = require("../utils/cryptoUtils");
const logger = require("../utils/logger");

/**
 * Format a date string to YYYY-MM-DD format
 * @param {string|null} dateString - Date string or null
 * @returns {string|null} - Formatted date or null
 */
const formatDate = (dateString) => {
  if (!dateString) return null;
  return new Date(dateString).toISOString().slice(0, 10);
};

/**
 * Create a new plan
 * @param {string} uid - User ID
 * @param {string} contents - Plan contents
 * @param {number} plannerId - Planner ID
 * @param {string|null} startDate - Start date (YYYY-MM-DD)
 * @param {string|null} dueDate - Due date (YYYY-MM-DD)
 * @param {number} priority - Priority (default: 1)
 * @returns {Promise<Object>} - Created plan data
 */
const createPlan = async (
  uid,
  contents,
  plannerId,
  startDate = null,
  dueDate = null,
  priority = 1,
) => {
  try {
    const hashedUid = hashUserId(uid);

    // Verify planner exists
    const planner = await db("planner")
      .where({ owner: hashedUid, id: plannerId })
      .first();

    if (!planner) {
      throw new Error("Planner not found");
    }

    // Get next plan ID
    const planId = await getNextId(hashedUid, "planId");

    // Format dates
    const formattedStartDate = formatDate(startDate);
    const formattedDueDate = formatDate(dueDate);

    // Encrypt plan contents
    const encryptedContents = encryptData(uid, contents);

    // Create plan with encrypted data
    await db("plan").insert({
      owner: hashedUid,
      startDate: formattedStartDate,
      dueDate: formattedDueDate,
      contents: encryptedContents,
      id: planId,
      from: plannerId,
      priority: priority || 1,
      isCompleted: 0,
      created_at: getTimestamp(),
    });

    // Return plain data for response
    return {
      owner: uid,
      startDate: formattedStartDate,
      dueDate: formattedDueDate,
      contents: contents,
      id: planId,
      from: plannerId,
      priority: priority || 1,
      isCompleted: 0,
    };
  } catch (error) {
    logger.error("Error creating plan:", error);
    throw error;
  }
};

/**
 * Get a plan by ID with decrypted content
 * @param {string} uid - User ID
 * @param {number} id - Plan ID
 * @returns {Promise<Object|null>} - Plan data or null if not found
 */
const getPlanById = async (uid, id) => {
  try {
    const hashedUid = hashUserId(uid);
    const plan = await db("plan").where({ owner: hashedUid, id: id }).first();

    if (!plan) return null;

    // Decrypt plan content
    return {
      ...plan,
      owner: uid, // Use original ID for application logic
      contents: decryptData(uid, plan.contents),
    };
  } catch (error) {
    logger.error("Error getting plan by ID:", error);
    throw error;
  }
};

/**
 * Get all plans for a user with decrypted content
 * @param {string} uid - User ID
 * @returns {Promise<Array>} - Array of plan objects
 */
const getAllPlans = async (uid) => {
  try {
    const hashedUid = hashUserId(uid);
    const plans = await db("plan")
      .where({ owner: hashedUid })
      .orderByRaw("isCompleted ASC, priority DESC, id ASC");

    // Decrypt plan contents
    return plans.map((plan) => ({
      ...plan,
      owner: uid, // Use original ID for application logic
      contents: decryptData(uid, plan.contents),
    }));
  } catch (error) {
    logger.error("Error getting all plans:", error);
    throw error;
  }
};

/**
 * Get all plans in a planner with decrypted content
 * @param {string} uid - User ID
 * @param {number} plannerId - Planner ID
 * @returns {Promise<Array>} - Array of plan objects
 */
const getPlansInPlanner = async (uid, plannerId) => {
  try {
    const hashedUid = hashUserId(uid);

    // Verify planner exists
    const planner = await db("planner")
      .where({ owner: hashedUid, id: plannerId })
      .first();

    if (!planner) {
      throw new Error("Planner not found");
    }

    const plans = await db("plan")
      .where({ owner: hashedUid, from: plannerId })
      .orderByRaw("isCompleted ASC, priority DESC, id ASC");

    // Decrypt plan contents
    return plans.map((plan) => ({
      ...plan,
      owner: uid, // Use original ID for application logic
      contents: decryptData(uid, plan.contents),
    }));
  } catch (error) {
    logger.error("Error getting plans in planner:", error);
    throw error;
  }
};

/**
 * Update a plan
 * @param {string} uid - User ID
 * @param {number} id - Plan ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Updated plan data
 */
const updatePlan = async (uid, id, updateData) => {
  try {
    const hashedUid = hashUserId(uid);
    const plan = await db("plan").where({ owner: hashedUid, id: id }).first();

    if (!plan) {
      throw new Error("Plan not found");
    }

    // Format dates if provided
    const formattedData = { ...updateData };
    if (formattedData.startDate !== undefined) {
      formattedData.startDate = formatDate(formattedData.startDate);
    }
    if (formattedData.dueDate !== undefined) {
      formattedData.dueDate = formatDate(formattedData.dueDate);
    }

    // Encrypt contents if provided
    if (formattedData.contents !== undefined) {
      formattedData.contents = encryptData(uid, formattedData.contents);
    }

    // Add update timestamp
    formattedData.updated_at = getTimestamp();

    await db("plan").where({ owner: hashedUid, id: id }).update(formattedData);

    // Get the updated plan with decrypted content
    return await getPlanById(uid, id);
  } catch (error) {
    logger.error("Error updating plan:", error);
    throw error;
  }
};

/**
 * Delete a plan
 * @param {string} uid - User ID
 * @param {number} id - Plan ID
 * @returns {Promise<boolean>} - Success status
 */
const deletePlan = async (uid, id) => {
  try {
    const hashedUid = hashUserId(uid);
    const plan = await db("plan").where({ owner: hashedUid, id: id }).first();

    if (!plan) {
      throw new Error("Plan not found");
    }

    await db("plan").where({ owner: hashedUid, id: id }).del();

    logger.info(
      `Plan deleted: ${hashedUid.substring(0, 8)}... - Plan ID: ${id}`,
    );
    return true;
  } catch (error) {
    logger.error("Error deleting plan:", error);
    throw error;
  }
};

/**
 * Mark a plan as completed
 * @param {string} uid - User ID
 * @param {number} id - Plan ID
 * @returns {Promise<Object>} - Updated plan data
 */
const completePlan = async (uid, id) => {
  try {
    const hashedUid = hashUserId(uid);
    const plan = await db("plan").where({ owner: hashedUid, id: id }).first();

    if (!plan) {
      throw new Error("Plan not found");
    }

    await db("plan").where({ owner: hashedUid, id: id }).update({
      isCompleted: 1,
      updated_at: getTimestamp(),
    });

    // Get the updated plan with decrypted content
    return await getPlanById(uid, id);
  } catch (error) {
    logger.error("Error completing plan:", error);
    throw error;
  }
};

module.exports = {
  createPlan,
  getPlanById,
  getAllPlans,
  getPlansInPlanner,
  updatePlan,
  deletePlan,
  completePlan,
};
