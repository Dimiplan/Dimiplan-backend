/**
 * Plan routes
 */
const express = require("express");
const { isAuthenticated, isUserRegistered } = require("../../middleware/auth");
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

/**
 * @route POST /api/task/add
 * @desc Create a new task
 */
router.post("/add", async (req, res) => {
  try {
    const { contents, priority, from, startDate, dueDate } = req.body;

    if (!contents || !from) {
      return res
        .status(400)
        .json({ message: "Contents and from are required" });
    }

    await createTask(req.userId, contents, from, startDate, dueDate, priority);

    res.status(201).json({ message: "Task added successfully" });
  } catch (error) {
    if (error.message === "Planner not found") {
      return res.status(404).json({ message: "Planner not found" });
    }

    console.error("Error adding task:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/task/update
 * @desc Update a task
 */
router.post("/update", async (req, res) => {
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

    res.status(200).json({ message: "Task updated successfully" });
  } catch (error) {
    if (error.message === "Task not found") {
      return res.status(404).json({ message: "Task not found" });
    }

    console.error("Error updating task:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/task/delete
 * @desc Delete a task
 */
router.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Id is required" });
    }

    await deleteTask(req.userId, id);

    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    if (error.message === "Task not found") {
      return res.status(404).json({ message: "Task not found" });
    }

    console.error("Error deleting task:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/task/complete
 * @desc Mark a task as completed
 */
router.post("/complete", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Id is required" });
    }

    await completeTask(req.userId, id);

    res.status(200).json({ message: "Task completed successfully" });
  } catch (error) {
    if (error.message === "Task not found") {
      return res.status(404).json({ message: "Task not found" });
    }

    console.error("Error completing task:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route GET /api/task/get
 * @desc Get all tasks in a planner (if planner not specified, get all)
 */
router.get("/get", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      const tasks = await getAllTasks(req.userId);

      if (tasks.length === 0) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.status(200).json(tasks);
    }

    const tasks = await getTasksInPlanner(req.userId, id);

    res.status(200).json(tasks);
  } catch (error) {
    if (error.message === "Planner not found") {
      return res.status(404).json({ message: "Planner not found" });
    }

    console.error("Error getting tasks in planner:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
