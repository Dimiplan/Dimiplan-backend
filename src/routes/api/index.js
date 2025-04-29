/**
 * API Routes Index
 * Handles all routes under /api
 */
const express = require("express");
const userRouter = require("./user");
const planRouter = require("./plan");
const aiRouter = require("./ai");
const { isAuthenticated } = require("../../middleware/auth");

const router = express.Router();

// Apply authentication to all API routes
router.use(isAuthenticated);

// Register route handlers
router.use("/user", userRouter);
router.use("/plan", planRouter);
router.use("/ai", aiRouter);

module.exports = router;
