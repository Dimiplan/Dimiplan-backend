const express = require("express");
const { isAuthenticated, isUserRegistered } = require("../../middleware/auth");
const {
  createRootFolder,
  createFolder,
  getFolderById,
  getFolderByNameAndParent,
  getFoldersInFolder,
} = require("../../models/folderModel");

const router = express.Router();

// Apply authentication and registration check to all routes
router.use(isAuthenticated, isUserRegistered);

/**
 * @route POST /api/folder/createRoot
 * @desc Create a root folder for the user
 */
router.post("/createRoot", async (req, res) => {
  try {
    const result = await createRootFolder(req.userId);

    if (result.exists) {
      return res.status(409).json({ message: "Root folder already exists" });
    }

    res.status(201).json({ message: "Root folder created" });
  } catch (error) {
    console.error("Error creating root folder:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/folder/add
 * @desc Create a new folder
 */
router.post("/add", async (req, res) => {
  try {
    const { name, from } = req.body;

    if (!name || from === undefined) {
      return res.status(400).json({ message: "Name and from are required" });
    }

    await createFolder(req.userId, name, from);

    res.status(200).json({ message: "Folder added successfully" });
  } catch (error) {
    if (error.message === "Invalid folder name") {
      return res.status(400).json({ message: "Invalid folder name" });
    } else if (error.message === "Parent folder not found") {
      return res.status(404).json({ message: "Folder not found" });
    }

    console.error("Error adding folder:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route GET /api/folder/get
 * @desc Get all folders within a folder
 */
router.get("/get", async (req, res) => {
  try {
    const { id, from, name } = req.query;
    let folder;

    // Get folder by ID or by name and parent
    if (id) {
      folder = await getFolderById(req.userId, id);
    } else if (name && from) {
      folder = await getFolderByNameAndParent(req.userId, name, from);
    } else {
      return res
        .status(400)
        .json({ message: "Id or (from + name) is required" });
    }

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    // Get folders within the folder
    const folders = await getFoldersInFolder(req.userId, folder.id);

    if (folders.length === 0) {
      return res.status(404).json({ message: "Folders not found" });
    }

    res.status(200).json(folders);
  } catch (error) {
    console.error("Error getting folders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
