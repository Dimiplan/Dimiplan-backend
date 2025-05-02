/**
 * Chat model
 * Handles all chat/AI-related database operations with encryption
 */
const db = require("../config/db");
const { getNextId } = require("../utils/dbUtils");
const {
  hashUserId,
  encryptData,
  decryptData,
  getTimestamp,
} = require("../utils/cryptoUtils");
const logger = require("../utils/logger");

/**
 * Create a new chat room
 * @param {string} uid - User ID
 * @param {string} name - Room name
 * @returns {Promise<Object>} - Created room data
 */
const createChatRoom = async (uid, name) => {
  try {
    const hashedUid = hashUserId(uid);
    const roomId = await getNextId(hashedUid, "roomId");

    // Encrypt room name
    const encryptedName = encryptData(uid, name);

    await db("chat_rooms").insert({
      owner: hashedUid,
      id: roomId,
      name: encryptedName,
      isProcessing: 0,
      created_at: getTimestamp(),
    });

    return {
      owner: uid,
      id: roomId,
      name: name, // Return plain text for response
    };
  } catch (error) {
    logger.error("Error creating chat room:", error);
    throw error;
  }
};

/**
 * Get all chat rooms for a user with decrypted names
 * @param {string} uid - User ID
 * @returns {Promise<Array>} - Array of chat room objects
 */
const getChatRooms = async (uid) => {
  try {
    const hashedUid = hashUserId(uid);
    const rooms = await db("chat_rooms")
      .where({ owner: hashedUid })
      .orderBy("id", "desc");

    // Decrypt room names
    return rooms.map((room) => ({
      ...room,
      owner: uid, // Use original ID for application logic
      name: decryptData(uid, room.name),
    }));
  } catch (error) {
    logger.error("Error getting chat rooms:", error);
    throw error;
  }
};

/**
 * Add messages to chat history with encryption
 * @param {string} uid - User ID
 * @param {number} roomId - Room ID
 * @param {string} userMessage - User's message
 * @param {string} aiMessage - AI's response message
 * @returns {Promise<Array>} - Added message objects
 */
const addChatMessages = async (uid, roomId, userMessage, aiMessage) => {
  try {
    const hashedUid = hashUserId(uid);

    // Get next chat ID
    const chatId = await getNextId(hashedUid, "chatId");
    const timestamp = getTimestamp();

    // Encrypt messages
    const encryptedUserMessage = encryptData(uid, userMessage);
    const encryptedAiMessage = encryptData(uid, aiMessage);

    // Add user message
    await db("chat").insert({
      from: roomId,
      owner: hashedUid,
      id: chatId,
      message: encryptedUserMessage,
      sender: "user",
      created_at: timestamp,
    });

    // Add AI response
    await db("chat").insert({
      from: roomId,
      owner: hashedUid,
      id: chatId + 1,
      message: encryptedAiMessage,
      sender: "ai",
      created_at: timestamp,
    });

    // Update chat ID counter
    await db("userid")
      .where({ owner: hashedUid })
      .update({ chatId: chatId + 2 });

    // Return plain text messages for response
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
    logger.error("Error adding chat messages:", error);
    throw error;
  }
};

/**
 * Get chat messages in a room with decryption
 * @param {string} uid - User ID
 * @param {number} roomId - Room ID
 * @returns {Promise<Array>} - Array of chat message objects
 */
const getChatMessages = async (uid, roomId) => {
  try {
    const hashedUid = hashUserId(uid);
    const messages = await db("chat")
      .where({ owner: hashedUid, from: roomId })
      .orderBy("id", "asc");

    // Decrypt message contents
    return messages.map((message) => ({
      ...message,
      owner: uid, // Use original ID for application logic
      message: decryptData(uid, message.message),
    }));
  } catch (error) {
    logger.error("Error getting chat messages:", error);
    throw error;
  }
};

/**
 * Delete a chat room and all its messages
 * @param {string} uid - User ID
 * @param {number} roomId - Room ID
 * @returns {Promise<boolean>} - Success status
 */
const deleteChatRoom = async (uid, roomId) => {
  try {
    const hashedUid = hashUserId(uid);

    // Verify room exists
    const room = await db("chat_rooms")
      .where({ owner: hashedUid, id: roomId })
      .first();

    if (!room) {
      throw new Error("Chat room not found");
    }

    // Execute as transaction to ensure all operations succeed or fail together
    await db.transaction(async (trx) => {
      // Delete all messages in the room
      await trx("chat").where({ owner: hashedUid, from: roomId }).del();

      // Delete the room
      await trx("chat_rooms").where({ owner: hashedUid, id: roomId }).del();
    });

    logger.info(
      `Chat room deleted: ${hashedUid.substring(0, 8)}... - Room ID: ${roomId}`,
    );
    return true;
  } catch (error) {
    logger.error("Error deleting chat room:", error);
    throw error;
  }
};

module.exports = {
  createChatRoom,
  getChatRooms,
  addChatMessages,
  getChatMessages,
  deleteChatRoom,
};
