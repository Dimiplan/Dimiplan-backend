const express = require("express");
const { isAuthenticated, isUserRegistered } = require("../../middleware/auth");
const {
  createPlanner,
  getPlannerById,
  getPlanners,
  renamePlanner,
  deletePlanner,
} = require("../../models/plannerModel");

const router = express.Router();

// Apply authentication and registration check to all routes
router.use(isAuthenticated, isUserRegistered);

/**
 * @route POST /api/planner/add
 * @desc Create a new planner
 */
router.post("/add", async (req, res) => {
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
 * @route POST /api/planner/rename
 * @desc Rename a planner
 */
router.post("/rename", async (req, res) => {
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
 * @route POST /api/planner/delete
 * @desc Delete a planner and all its plans
 */
router.post("/delete", async (req, res) => {
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
 * @route GET /api/planner/getInfo
 * @desc Get information about a planner
 */
router.get("/getInfo", async (req, res) => {
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
 * @route GET /api/planner/getPlanners
 * @desc Get all planners in a folder
 */
router.get("/getPlanners", async (req, res) => {
  try {
    // Get planners in the folder
    const planners = await getPlanners(req.userId);

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

module.exports = router;
