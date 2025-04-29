/**
 * GitHub webhook routes
 */
const express = require("express");
const crypto = require("crypto");
const { exec } = require("child_process");
const path = require("path");

const router = express.Router();

// GitHub webhook secret from environment variable
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

/**
 * Verify GitHub webhook signature
 * @param {string} signature - GitHub signature header
 * @param {string} payload - Request body as string
 * @returns {boolean} - Whether the signature is valid
 */
const verifySignature = (signature, payload) => {
  if (!WEBHOOK_SECRET || !signature) return false;

  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = `sha256=${hmac.update(payload).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
};

/**
 * Execute git pull in project directory
 * @returns {Promise<string>} - Command output
 */
const gitPull = () => {
  return new Promise((resolve, reject) => {
    // Path to repository root directory
    const repoPath = path.join(__dirname, "../..");

    exec("git pull", { cwd: repoPath }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Git pull error: ${error.message}`);
        return reject(error);
      }

      if (stderr) {
        console.log(`Git pull stderr: ${stderr}`);
      }

      resolve(stdout);
    });
  });
};

/**
 * @route POST /update
 * @desc GitHub webhook to update the application
 */
router.post(
  "/update",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      // Get GitHub signature
      const signature = req.headers["x-hub-signature-256"];

      // Verify the webhook signature
      if (!verifySignature(signature, req.body.toString())) {
        console.error("Invalid webhook signature");
        return res.status(401).json({ message: "Invalid signature" });
      }

      // Parse the webhook payload
      const payload = JSON.parse(req.body.toString());

      // Only process push events to main/master branch
      const branch = payload.ref ? payload.ref.replace("refs/heads/", "") : "";
      if (
        payload.event_type !== "push" &&
        !["main", "master"].includes(branch)
      ) {
        return res
          .status(200)
          .json({ message: "Ignored event type or branch" });
      }

      // Execute git pull
      console.log("Executing git pull due to GitHub webhook...");
      const output = await gitPull();
      console.log(`Git pull output: ${output}`);

      // Send success response
      res.status(200).json({ message: "Repository updated successfully" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ message: "Webhook processing error" });
    }
  },
);

module.exports = router;
