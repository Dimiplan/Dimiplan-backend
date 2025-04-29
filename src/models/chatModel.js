/**
 * Chat model
 * Handles all chat/AI-related database operations
 */
const db = require("../config/db");
const { getNextId } = require("../utils/dbUtils");

/**
 * Create a new chat room
 * @param {string} uid - User ID
 * @param {string} name - Room name
 * @returns {Promise<Object>} - Created room data
 */
const createChatRoom = async (uid, name) => {
  try {
    const roomId = await getNextId(uid, "roomId");

    await db("chat_rooms").insert({
      owner: uid,
      id: roomId,
      name: name,
    });

    return {
      owner: uid,
      id: roomId,
      name: name,
    };
  } catch (error) {
    console.error("Error creating chat room:", error);
    throw error;
  }
};

/**
 * Get all chat rooms for a user
 * @param {string} uid - User ID
 * @returns {Promise<Array>} - Array of chat room objects
 */
const getChatRooms = async (uid) => {
  try {
    return await db("chat_rooms").where({ owner: uid }).orderBy("id", "desc");
  } catch (error) {
    console.error("Error getting chat rooms:", error);
    throw error;
  }
};

/**
 * Add messages to chat history
 * @param {string} uid - User ID
 * @param {number} roomId - Room ID
 * @param {string} userMessage - User's message
 * @param {string} aiMessage - AI's response message
 * @returns {Promise<Array>} - Added message objects
 */
const addChatMessages = async (uid, roomId, userMessage, aiMessage) => {
  try {
    // Get next chat ID
    const chatId = await getNextId(uid, "chatId");

    // Add user message
    await db("chat").insert({
      from: roomId,
      owner: uid,
      id: chatId,
      message: userMessage,
      sender: "user",
    });

    // Add AI response
    await db("chat").insert({
      from: roomId,
      owner: uid,
      id: chatId + 1,
      message: aiMessage,
      sender: "ai",
    });

    // Update chat ID counter
    await db("userid")
      .where({ owner: uid })
      .update({ chatId: chatId + 2 });

    return [
      {
        from: roomId,
        owner: uid,
        id: chatId,
        message: userMessage,
        sender: "user",
      },
      {
        from: roomId,
        owner: uid,
        id: chatId + 1,
        message: aiMessage,
        sender: "ai",
      },
    ];
  } catch (error) {
    console.error("Error adding chat messages:", error);
    throw error;
  }
};

/**
 * Get chat messages in a room
 * @param {string} uid - User ID
 * @param {number} roomId - Room ID
 * @returns {Promise<Array>} - Array of chat message objects
 */
const getChatMessages = async (uid, roomId) => {
  try {
    return await db("chat")
      .where({ owner: uid, from: roomId })
      .orderBy("id", "asc");
  } catch (error) {
    console.error("Error getting chat messages:", error);
    throw error;
  }
};

module.exports = {
  createChatRoom,
  getChatRooms,
  addChatMessages,
  getChatMessages,
};
