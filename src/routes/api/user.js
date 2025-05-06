/**
 * User routes
 */
const express = require("express");
const { getUser, isRegistered, updateUser } = require("../../models/userModel");
const { isAuthenticated } = require("../../middleware/auth");

const router = express.Router();

/**
 * Validate user data
 * @param {Object} userData - User data to validate
 * @returns {boolean} - Whether the data is valid
 */
const validateUserData = (userData) => {
  let isValid = true;

  // Validate name (15 characters max)
  if (userData.name && userData.name.toString().length > 15) {
    isValid = false;
  }

  // Validate grade (1-3)
  if (
    userData.grade &&
    (isNaN(parseInt(userData.grade.toString())) ||
      parseInt(userData.grade.toString()) > 3 ||
      parseInt(userData.grade.toString()) < 1)
  ) {
    isValid = false;
  }

  // Validate class (1-6)
  if (
    userData.class &&
    (isNaN(parseInt(userData.class.toString())) ||
      parseInt(userData.class.toString()) > 6 ||
      parseInt(userData.class.toString()) < 1)
  ) {
    isValid = false;
  }

  return isValid;
};

/**
 * @route POST /api/user/update
 * @desc Update user information
 */
router.post("/update", isAuthenticated, async (req, res) => {
  try {
    const { name, grade, class: classInput, email, profile_image } = req.body;

    // Process input data
    const userData = {
      name: name ? name.toString() : undefined,
      grade: grade ? parseInt(grade.toString()) : undefined,
      class: classInput ? parseInt(classInput.toString()) : undefined,
      email: email ? email.toString() : undefined,
      profile_image: profile_image ? profile_image.toString() : undefined,
    };

    // Validate data
    if (!validateUserData(userData)) {
      return res.status(400).json({ message: "Bad request" });
    }

    // Filter out undefined fields
    const cleanedData = Object.keys(userData).reduce((acc, key) => {
      if (userData[key] !== undefined) {
        acc[key] = userData[key];
      }
      return acc;
    }, {});

    // Check if there's anything to update
    if (Object.keys(cleanedData).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Update user
    await updateUser(req.userId, cleanedData);

    res.status(200).json({ message: "Updated" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route GET /api/user/registered
 * @desc Check if user is registered
 */
router.get("/registered", isAuthenticated, async (req, res) => {
  try {
    const registered = await isRegistered(req.userId);
    res.status(registered ? 200 : 401).json({ registered });
  } catch (error) {
    console.error("Error checking registration:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route GET /api/user/get
 * @desc Get current user information
 */
router.get("/get", isAuthenticated, async (req, res) => {
  try {
    const user = await getUser(req.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error getting user info:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
