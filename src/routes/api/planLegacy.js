/**
 * Plan routes
 * @deprecated
 */
const express = require("express");
const { isAuthenticated, isUserRegistered } = require("../../middleware/auth");
const {
  createRootFolder,
  createFolder,
  getFolderById,
  getFolderByNameAndParent,
  getFoldersInFolder,
} = require("../../models/folderModel");
const {
  createPlanner,
  getPlannerById,
  getPlannersInFolder,
  renamePlanner,
  deletePlanner,
} = require("../../models/plannerModel");
const {
  createTask,
  getAllTasks,
  getTasksInPlanner,
  updateTask,
  deleteTask,
  completeTask,
} = require("../../models/taskModel");

const router = express.Router();

// Apply authentication and registration check to all routes
router.use(isAuthenticated, isUserRegistered);

//---------------- Folder Routes ----------------//

/**
 * @route POST /api/plan/createRootFolder
 * @desc Create a root folder for the user
 */
router.post("/createRootFolder", async (req, res) => {
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
 * @route POST /api/plan/addFolder
 * @desc Create a new folder
 */
router.post("/addFolder", async (req, res) => {
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
 * @route GET /api/plan/getFoldersInFolder
 * @desc Get all folders within a folder
 */
router.get("/getFoldersInFolder", async (req, res) => {
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

//---------------- Planner Routes ----------------//

/**
 * @route POST /api/plan/addPlanner
 * @desc Create a new planner
 */
router.post("/addPlanner", async (req, res) => {
  try {
    const { name, isDaily, from } = req.body;

    if (name == undefined || from == undefined) {
      return res.status(400).json({ message: "Name and from are required" });
    }

    await createPlanner(req.userId, name, isDaily, from);

    res.status(201).json({ message: "Planner added successfully" });
  } catch (error) {
    if (error.message === "Folder not found") {
      return res.status(404).json({ message: "Folder not found" });
    } else if (
      error.message === "Planner with same name already exists in this folder"
    ) {
      return res.status(409).json({ message: "Same planner already exists" });
    }

    console.error("Error adding planner:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/plan/renamePlanner
 * @desc Rename a planner
 */
router.post("/renamePlanner", async (req, res) => {
  try {
    const { id, name } = req.body;

    if (!id || !name) {
      return res.status(400).json({ message: "Id and name are required" });
    }

    await renamePlanner(req.userId, id, name);

    res.status(200).json({ message: "Planner renamed successfully" });
  } catch (error) {
    if (error.message === "Planner not found") {
      return res.status(404).json({ message: "Planner not found" });
    } else if (
      error.message === "Planner with same name already exists in this folder"
    ) {
      return res.status(409).json({
        message: "Planner with same name already exists in this folder",
      });
    }

    console.error("Error renaming planner:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/plan/deletePlanner
 * @desc Delete a planner and all its plans
 */
router.post("/deletePlanner", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Id is required" });
    }

    await deletePlanner(req.userId, id);

    res.status(200).json({
      message: "Planner and all associated plans deleted successfully",
    });
  } catch (error) {
    if (error.message === "Planner not found") {
      return res.status(404).json({ message: "Planner not found" });
    }

    console.error("Error deleting planner:", error);
    res
      .status(500)
      .json({ message: "Error deleting planner", error: error.message });
  }
});

/**
 * @route GET /api/plan/getPlannerInfoByID
 * @desc Get information about a planner
 */
router.get("/getPlannerInfoByID", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ message: "Bad Request" });
    }

    const planner = await getPlannerById(req.userId, id);

    if (!planner) {
      return res.status(404).json({ message: "Planner not found" });
    }

    res.status(200).json(planner);
  } catch (error) {
    console.error("Error getting planner:", error);
    res
      .status(500)
      .json({ message: "Error retrieving planner", error: error.message });
  }
});

/**
 * @route GET /api/plan/getPlannersInFolder
 * @desc Get all planners in a folder
 */
router.get("/getPlannersInFolder", async (req, res) => {
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

    // Get planners in the folder
    const planners = await getPlannersInFolder(req.userId, folder.id);

    if (planners.length === 0) {
      return res.status(404).json({ message: "Planner not found" });
    }

    res.status(200).json(planners);
  } catch (error) {
    console.error("Error getting planners:", error);
    res
      .status(500)
      .json({ message: "Error retrieving planners", error: error.message });
  }
});

//---------------- Plan Routes ----------------//

/**
 * @route POST /api/plan/addPlan
 * @desc Create a new plan
 */
router.post("/addPlan", async (req, res) => {
  try {
    const { contents, priority, from, startDate, dueDate } = req.body;

    if (!contents || !from) {
      return res
        .status(400)
        .json({ message: "Contents and from are required" });
    }

    await createTask(req.userId, contents, from, startDate, dueDate, priority);

    res.status(201).json({ message: "Plan added successfully" });
  } catch (error) {
    if (error.message === "Planner not found") {
      return res.status(404).json({ message: "Planner not found" });
    }

    console.error("Error adding plan:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/plan/updateTask
 * @desc Update a plan
 */
router.post("/updateTask", async (req, res) => {
  try {
    const { id, contents, priority, from, startDate, dueDate, isCompleted } =
      req.body;

    if (!id) {
      return res.status(400).json({ message: "Id is required" });
    }

    // Check if any update data is provided
    const updateData = {};
    if (contents !== undefined) updateData.contents = contents;
    if (priority !== undefined) updateData.priority = priority;
    if (from !== undefined) updateData.from = from;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "Data is required" });
    }

    await updateTask(req.userId, id, updateData);

    res.status(200).json({ message: "Plan updated successfully" });
  } catch (error) {
    if (error.message === "Plan not found") {
      return res.status(404).json({ message: "Plan not found" });
    }

    console.error("Error updating plan:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/plan/deletePlan
 * @desc Delete a plan
 */
router.post("/deletePlan", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Id is required" });
    }

    await deleteTask(req.userId, id);

    res.status(200).json({ message: "Plan deleted successfully" });
  } catch (error) {
    if (error.message === "Plan not found") {
      return res.status(404).json({ message: "Plan not found" });
    }

    console.error("Error deleting plan:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/plan/completeTask
 * @desc Mark a plan as completed
 */
router.post("/completeTask", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Id is required" });
    }

    await completeTask(req.userId, id);

    res.status(200).json({ message: "Plan completed successfully" });
  } catch (error) {
    if (error.message === "Plan not found") {
      return res.status(404).json({ message: "Plan not found" });
    }

    console.error("Error completing plan:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route GET /api/plan/getEveryPlan
 * @desc Get all plans for a user
 */
router.get("/getEveryPlan", async (req, res) => {
  try {
    const plans = await getAllTasks(req.userId);

    if (plans.length === 0) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.status(200).json(plans);
  } catch (error) {
    console.error("Error getting all plans:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route GET /api/plan/getPlanInPlanner
 * @desc Get all plans in a planner
 */
router.get("/getPlanInPlanner", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ message: "Id is required" });
    }

    const plans = await getTasksInPlanner(req.userId, id);

    res.status(200).json(plans);
  } catch (error) {
    if (error.message === "Planner not found") {
      return res.status(404).json({ message: "Planner not found" });
    }

    console.error("Error getting plans in planner:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
