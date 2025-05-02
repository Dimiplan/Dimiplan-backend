/**
 * Folder model
 * Handles all folder-related database operations with encryption
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
    // Hash user ID for database operations
    const hashedUid = hashUserId(uid);

    const rootExists = await db("folders")
      .where({ owner: hashedUid, id: 0 })
      .first();

    if (rootExists) {
      return { exists: true };
    }

    // Create root folder with encrypted name
    await db("folders").insert({
      owner: hashedUid,
      name: encryptData(uid, "Root"),
      id: 0,
      from: -1,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    });

    logger.info(
      `Root folder created for user: ${hashedUid.substring(0, 8)}...`,
    );
    return { created: true };
  } catch (error) {
    logger.error("Error creating root folder:", error);
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

    // Hash user ID for database operations
    const hashedUid = hashUserId(uid);

    // Verify parent folder exists if not root
    if (from !== -1) {
      const parentFolder = await db("folders")
        .where({ owner: hashedUid, id: from })
        .first();

      if (!parentFolder) {
        throw new Error("Parent folder not found");
      }
    }

    // Get next folder ID
    const folderId = await getNextId(hashedUid, "folderId");

    // Create folder with encrypted name
    await db("folders").insert({
      owner: hashedUid,
      name: encryptData(uid, name),
      id: folderId,
      from: from,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    });

    // Return data with decrypted name for response
    return {
      owner: uid,
      name: name,
      id: folderId,
      from: from,
    };
  } catch (error) {
    logger.error("Error creating folder:", error);
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
    // Hash user ID for database operations
    const hashedUid = hashUserId(uid);

    // Get folder with encrypted name
    const folder = await db("folders")
      .where({ owner: hashedUid, id: id })
      .first();

    if (!folder) return null;

    // Return data with decrypted name
    return {
      ...folder,
      owner: uid, // Use original ID for application logic
      name: decryptData(uid, folder.name),
    };
  } catch (error) {
    logger.error("Error getting folder by ID:", error);
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
    // Hash user ID for database operations
    const hashedUid = hashUserId(uid);

    // Encrypt folder name for search
    const encryptedName = encryptData(uid, name);

    // Search for folder with encrypted name
    const folder = await db("folders")
      .where({
        owner: hashedUid,
        name: encryptedName,
        from: from,
      })
      .first();

    if (!folder) return null;

    // Return data with decrypted name
    return {
      ...folder,
      owner: uid, // Use original ID for application logic
      name: name, // Already have the plain name from parameter
    };
  } catch (error) {
    logger.error("Error getting folder by name and parent:", error);
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
    // Hash user ID for database operations
    const hashedUid = hashUserId(uid);

    // Get folders with encrypted names
    const folders = await db("folders")
      .where({ owner: hashedUid, from: folderId })
      .orderBy("id", "asc");

    // Return data with decrypted names
    return folders.map((folder) => ({
      ...folder,
      owner: uid, // Use original ID for application logic
      name: decryptData(uid, folder.name),
    }));
  } catch (error) {
    logger.error("Error getting folders in folder:", error);
    throw error;
  }
};

/**
 * Rename a folder
 * @param {string} uid - User ID
 * @param {number} id - Folder ID
 * @param {string} newName - New folder name
 * @returns {Promise<Object>} - Updated folder data
 */
const renameFolder = async (uid, id, newName) => {
  try {
    // Validate name
    if (!isValidFolderName(newName)) {
      throw new Error("Invalid folder name");
    }

    // Hash user ID for database operations
    const hashedUid = hashUserId(uid);

    // Check if folder exists
    const folder = await db("folders")
      .where({ owner: hashedUid, id: id })
      .first();

    if (!folder) {
      throw new Error("Folder not found");
    }

    // Check for name conflicts
    const existingFolder = await db("folders")
      .where({
        owner: hashedUid,
        from: folder.from,
        name: encryptData(uid, newName),
      })
      .whereNot({ id: id })
      .first();

    if (existingFolder) {
      throw new Error("Folder with same name already exists in this location");
    }

    // Update folder with encrypted name
    await db("folders")
      .where({ owner: hashedUid, id: id })
      .update({
        name: encryptData(uid, newName),
        updated_at: getTimestamp(),
      });

    // Return updated data with decrypted name
    return {
      ...folder,
      owner: uid,
      name: newName,
    };
  } catch (error) {
    logger.error("Error renaming folder:", error);
    throw error;
  }
};

/**
 * Delete a folder and all its contents
 * @param {string} uid - User ID
 * @param {number} id - Folder ID
 * @returns {Promise<boolean>} - Success status
 */
const deleteFolder = async (uid, id) => {
  try {
    // Cannot delete root folder
    if (id === 0) {
      throw new Error("Cannot delete root folder");
    }

    // Hash user ID for database operations
    const hashedUid = hashUserId(uid);

    // Check if folder exists
    const folder = await db("folders")
      .where({ owner: hashedUid, id: id })
      .first();

    if (!folder) {
      throw new Error("Folder not found");
    }

    // Use transaction to ensure all operations succeed or fail together
    await db.transaction(async (trx) => {
      // Recursively delete subfolders
      const subfolders = await trx("folders").where({
        owner: hashedUid,
        from: id,
      });

      for (const subfolder of subfolders) {
        // Recursively delete each subfolder
        // Note: This is a simplified approach - for deep hierarchies,
        // a more efficient recursive query might be better
        await deleteFolder(uid, subfolder.id);
      }

      // Delete planners in the folder
      const planners = await trx("planner").where({
        owner: hashedUid,
        from: id,
      });

      for (const planner of planners) {
        // Delete plans in each planner
        await trx("plan").where({ owner: hashedUid, from: planner.id }).del();
      }

      // Delete the planners
      await trx("planner").where({ owner: hashedUid, from: id }).del();

      // Finally delete the folder itself
      await trx("folders").where({ owner: hashedUid, id: id }).del();
    });

    logger.info(
      `Folder deleted: ${hashedUid.substring(0, 8)}... - Folder ID: ${id}`,
    );
    return true;
  } catch (error) {
    logger.error("Error deleting folder:", error);
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
  renameFolder,
  deleteFolder,
};
