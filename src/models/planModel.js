/**
 * Plan model
 * Handles all plan-related database operations
 */
const db = require("../config/db");
const { getNextId } = require("../utils/dbUtils");

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
    // Verify planner exists
    const planner = await db("planner")
      .where({ owner: uid, id: plannerId })
      .first();

    if (!planner) {
      throw new Error("Planner not found");
    }

    // Get next plan ID
    const planId = await getNextId(uid, "planId");

    // Format dates
    const formattedStartDate = formatDate(startDate);
    const formattedDueDate = formatDate(dueDate);

    // Create plan
    await db("plan").insert({
      owner: uid,
      startDate: formattedStartDate,
      dueDate: formattedDueDate,
      contents: contents,
      id: planId,
      from: plannerId,
      priority: priority || 1,
      isCompleted: 0,
    });

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
    console.error("Error creating plan:", error);
    throw error;
  }
};

/**
 * Get a plan by ID
 * @param {string} uid - User ID
 * @param {number} id - Plan ID
 * @returns {Promise<Object|null>} - Plan data or null if not found
 */
const getPlanById = async (uid, id) => {
  try {
    return await db("plan").where({ owner: uid, id: id }).first();
  } catch (error) {
    console.error("Error getting plan by ID:", error);
    throw error;
  }
};

/**
 * Get all plans for a user
 * @param {string} uid - User ID
 * @returns {Promise<Array>} - Array of plan objects
 */
const getAllPlans = async (uid) => {
  try {
    return await db("plan")
      .where({ owner: uid })
      .orderByRaw("isCompleted ASC, priority DESC, id ASC");
  } catch (error) {
    console.error("Error getting all plans:", error);
    throw error;
  }
};

/**
 * Get all plans in a planner
 * @param {string} uid - User ID
 * @param {number} plannerId - Planner ID
 * @returns {Promise<Array>} - Array of plan objects
 */
const getPlansInPlanner = async (uid, plannerId) => {
  try {
    // Verify planner exists
    const planner = await db("planner")
      .where({ owner: uid, id: plannerId })
      .first();

    if (!planner) {
      throw new Error("Planner not found");
    }

    return await db("plan")
      .where({ owner: uid, from: plannerId })
      .orderByRaw("isCompleted ASC, priority DESC, id ASC");
  } catch (error) {
    console.error("Error getting plans in planner:", error);
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
    const plan = await getPlanById(uid, id);

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

    await db("plan").where({ owner: uid, id: id }).update(formattedData);

    return {
      ...plan,
      ...formattedData,
    };
  } catch (error) {
    console.error("Error updating plan:", error);
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
    const plan = await getPlanById(uid, id);

    if (!plan) {
      throw new Error("Plan not found");
    }

    await db("plan").where({ owner: uid, id: id }).del();

    return true;
  } catch (error) {
    console.error("Error deleting plan:", error);
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
    const plan = await getPlanById(uid, id);

    if (!plan) {
      throw new Error("Plan not found");
    }

    await db("plan").where({ owner: uid, id: id }).update({ isCompleted: 1 });

    return {
      ...plan,
      isCompleted: 1,
    };
  } catch (error) {
    console.error("Error completing plan:", error);
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
