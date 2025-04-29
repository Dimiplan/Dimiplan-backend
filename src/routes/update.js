/**
 * Update route
 * Handles automatic updates via git pull when receiving a POST request
 */
const express = require("express");
const { exec } = require("child_process");
const router = express.Router();

/**
 * @route POST /update
 * @desc Execute git stash && git pull to update the codebase
 */
router.post("/", (req, res) => {
  console.log("Received update request. Executing git stash && git pull...");

  exec("git stash && git pull", (error, stdout, stderr) => {
    if (error) {
      console.error(`Git update error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: "Git update failed",
        error: error.message,
      });
    }

    if (stderr) {
      console.log(`Git stderr: ${stderr}`);
    }

    console.log(`Git update successful: ${stdout}`);
    return res.status(200).json({
      success: true,
      message: "Git update successful",
      output: stdout,
    });
  });
});

module.exports = router;
