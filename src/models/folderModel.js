/**
 * Folder model
 * Handles all folder-related database operations
 */
const db = require("../config/db");
const { getNextId } = require("../utils/dbUtils");

// Blacklisted folder names
const FOLDER_NAME_BLACKLIST = ["Root", "root", "new", "all"];

/**
 * Check if a folder name is valid
 * @param {string} name - Folder name to check
 * @returns {boolean} - True if name is valid
 */
const isValidFolderName = (name) => {
  if (FOLDER_NAME_BLACKLIST.includes(name)) return false;
  if (name.endsWith(".pn")) return false;
  return true;
};

/**
 * Create a root folder for a user
 * @param {string} uid - User ID
 * @returns {Promise} - Result of the database operation
 */
const createRootFolder = async (uid) => {
  try {
    const rootExists = await db("folders").where({ owner: uid, id: 0 }).first();

    if (rootExists) {
      return { exists: true };
    }

    await db("folders").insert({
      owner: uid,
      name: "Root",
      id: 0,
      from: -1,
    });

    return { created: true };
  } catch (error) {
    console.error("Error creating root folder:", error);
    throw error;
  }
};

/**
 * Create a new folder
 * @param {string} uid - User ID
 * @param {string} name - Folder name
 * @param {number} from - Parent folder ID
 * @returns {Promise<Object>} - New folder data
 */
const createFolder = async (uid, name, from) => {
  try {
    // Validate name
    if (!isValidFolderName(name)) {
      throw new Error("Invalid folder name");
    }

    // Verify parent folder exists if not root
    if (from !== -1) {
      const parentFolder = await db("folders")
        .where({ owner: uid, id: from })
        .first();

      if (!parentFolder) {
        throw new Error("Parent folder not found");
      }
    }

    // Get next folder ID
    const folderId = await getNextId(uid, "folderId");

    // Create folder
    await db("folders").insert({
      owner: uid,
      name: name,
      id: folderId,
      from: from,
    });

    return {
      owner: uid,
      name: name,
      id: folderId,
      from: from,
    };
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
};

/**
 * Get a folder by ID
 * @param {string} uid - User ID
 * @param {number} id - Folder ID
 * @returns {Promise<Object|null>} - Folder data or null if not found
 */
const getFolderById = async (uid, id) => {
  try {
    return await db("folders").where({ owner: uid, id: id }).first();
  } catch (error) {
    console.error("Error getting folder by ID:", error);
    throw error;
  }
};

/**
 * Get a folder by name and parent ID
 * @param {string} uid - User ID
 * @param {string} name - Folder name
 * @param {number} from - Parent folder ID
 * @returns {Promise<Object|null>} - Folder data or null if not found
 */
const getFolderByNameAndParent = async (uid, name, from) => {
  try {
    return await db("folders")
      .where({ owner: uid, name: name, from: from })
      .first();
  } catch (error) {
    console.error("Error getting folder by name and parent:", error);
    throw error;
  }
};

/**
 * Get all folders within a folder
 * @param {string} uid - User ID
 * @param {number} folderId - Parent folder ID
 * @returns {Promise<Array>} - Array of folder objects
 */
const getFoldersInFolder = async (uid, folderId) => {
  try {
    return await db("folders")
      .where({ owner: uid, from: folderId })
      .orderBy("id", "asc");
  } catch (error) {
    console.error("Error getting folders in folder:", error);
    throw error;
  }
};

module.exports = {
  isValidFolderName,
  createRootFolder,
  createFolder,
  getFolderById,
  getFolderByNameAndParent,
  getFoldersInFolder,
};
