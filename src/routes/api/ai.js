/**
 * AI routes
 */
const express = require("express");
const { isAuthenticated, isUserRegistered } = require("../../middleware/auth");
const {
  createChatRoom,
  getChatRooms,
  addChatMessages,
  getChatMessages,
} = require("../../models/chatModel");
const {
  generateResponse,
  generateAutoResponse,
} = require("../../services/aiService");

const router = express.Router();

// Apply authentication and registration check to all routes
router.use(isAuthenticated, isUserRegistered);

/**
 * @route GET /api/ai/getRoomList
 * @desc Get all chat rooms for a user
 */
router.get("/getRoomList", async (req, res) => {
  try {
    const roomData = await getChatRooms(req.userId);
    res.status(200).json({ roomData });
  } catch (error) {
    console.error("Error fetching room list:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/ai/addRoom
 * @desc Create a new chat room
 */
router.post("/addRoom", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Room name is required" });
    }

    await createChatRoom(req.userId, name);

    res.status(200).json({ message: "Room added successfully" });
  } catch (error) {
    console.error("Error adding room:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route GET /api/ai/getChatInRoom
 * @desc Get all chat messages in a room
 */
router.get("/getChatInRoom", async (req, res) => {
  try {
    const { from } = req.query;

    if (!from) {
      return res.status(400).json({ message: "Room ID is required" });
    }

    const chatData = await getChatMessages(req.userId, from);

    res.status(200).json({ chatData });
  } catch (error) {
    console.error("Error fetching chat data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Helper function to handle AI response generation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} model - AI model to use
 * @deprecated
 */
const customAiRequest = async (req, res, model) => {
  try {
    const { prompt, room } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: "Prompt is required" });
    }

    if (!room) {
      return res.status(400).json({ message: "Room ID is required" });
    }

    // Generate AI response
    const response = await generateResponse(model, prompt);

    // Save messages to database
    const aiResponseText = response.output_text || "";
    await addChatMessages(req.userId, room, prompt, aiResponseText);

    res.status(200).json({ response });
  } catch (error) {
    console.error(`Error generating ${model} response:`, error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Helper function to handle AI response generation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const autoAiRequest = async (req, res) => {
  try {
    const { prompt, room } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: "Prompt is required" });
    }

    if (!room) {
      return res.status(400).json({ message: "Room ID is required" });
    }

    // Generate AI response
    const response = await generateAutoResponse(prompt);

    // Save messages to database
    const aiResponseText = response.output_text || "";
    await addChatMessages(req.userId, room, prompt, aiResponseText);

    res.status(200).json({ response });
  } catch (error) {
    console.error(`Error generating ${model} response:`, error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * @route POST /api/ai/auto
 * @desc Generate response using Auto model
 * @deprecated
 */
router.post("/auto", async (req, res) => {
  await autoAiRequest(req, res);
});

/**
 * @route POST /api/ai/gpt4o_m
 * @desc Generate response using GPT-4o Mini model
 * @deprecated
 */
router.post("/gpt4o_m", async (req, res) => {
  await autoAiRequest(req, res);
});

/**
 * @route POST /api/ai/gpt4o
 * @desc Generate response using GPT-4o model
 * @deprecated
 */
router.post("/gpt4o", async (req, res) => {
  await autoAiRequest(req, res);
});

/**
 * @route POST /api/ai/gpt41
 * @desc Generate response using GPT-4.1 model
 * @deprecated
 */
router.post("/gpt41", async (req, res) => {
  await autoAiRequest(req, res);
});

/**
 * @route POST /api/ai/o4-mini
 * @desc Generate response using o4-mini model
 * @deprecated
 */
router.post("/o4-mini", async (req, res) => {
  await autoAiRequest(req, res);
});

module.exports = router;
