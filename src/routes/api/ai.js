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
const { AI_MODELS, generateResponse } = require("../../services/aiService");

const router = express.Router();

// Apply authentication and registration check to all routes
router.use(isAuthenticated, isUserRegistered);

/**
 * @route GET /api/ai/get-room-list
 * @desc Get all chat rooms for a user
 */
router.get("/get-room-list", async (req, res) => {
  try {
    const roomData = await getChatRooms(req.userId);
    res.status(200).json({ roomData });
  } catch (error) {
    console.error("Error fetching room list:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/ai/add-room
 * @desc Create a new chat room
 */
router.post("/add-room", async (req, res) => {
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
 * @route GET /api/ai/get-chat-in-room
 * @desc Get all chat messages in a room
 */
router.get("/get-chat-in-room", async (req, res) => {
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
 */
const handleAiRequest = async (req, res, model) => {
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

    console.log(response);

    // Save messages to database
    const aiResponseText = response.choices[0].text || "";
    await addChatMessages(req.userId, room, prompt, aiResponseText);

    res.status(200).json({ response });
  } catch (error) {
    console.error(`Error generating ${model} response:`, error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * @route POST /api/ai/gpt4o-mini
 * @desc Generate response using GPT-4o Mini model
 */
router.post("/gpt4o-mini", async (req, res) => {
  await handleAiRequest(req, res, AI_MODELS.GPT4O_MINI);
});

/**
 * @route POST /api/ai/gpt4o
 * @desc Generate response using GPT-4o model
 */
router.post("/gpt4o", async (req, res) => {
  await handleAiRequest(req, res, AI_MODELS.GPT4O);
});

/**
 * @route POST /api/ai/gpt41
 * @desc Generate response using GPT-4.1 model
 */
router.post("/gpt41", async (req, res) => {
  await handleAiRequest(req, res, AI_MODELS.GPT41);
});

/**
 * @route POST /api/ai/o4-mini
 * @desc Generate response using o4-mini model
 */
router.post("/o4-mini", async (req, res) => {
  await handleAiRequest(req, res, AI_MODELS.O4_MINI);
});

module.exports = router;
