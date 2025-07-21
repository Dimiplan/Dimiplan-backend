import { db } from "../config/db.mjs";
import { decryptData, encryptData, hashUserId } from "../utils/crypto.mjs";
import { formatDateForMySQL } from "../utils/date.mjs";
import { getNextId } from "../utils/db.mjs";
import logger from "../utils/logger.mjs";

export const createChatRoom = async (uid, name) => {
  try {
    const hashedUid = hashUserId(uid);
    const roomId = await getNextId(hashedUid, "roomId");

    const encryptedName = encryptData(uid, name);

    await db("chat_rooms").insert({
      owner: hashedUid,
      id: roomId,
      name: encryptedName,
      isProcessing: 0,
      created_at: formatDateForMySQL(),
    });

    return {
      owner: uid,
      id: roomId,
      name: name,
    };
  } catch (error) {
    logger.error("채팅방 생성 오류:", error);
    throw error;
  }
};

export const renameChatRoom = async (uid, roomId) => {
    try {
        const hashedUid = hashUserId(uid);

        const room = await db("chat_rooms")
        .where({ owner: hashedUid, id: roomId })
        .first();

        if (!room) {
        throw new Error("채팅방을 찾을 수 없습니다");
        }

        const newName = encryptData(uid, room.name);
        await db("chat_rooms")
        .where({ owner: hashedUid, id: roomId })
        .update({ name: newName });

        logger.info(
        `채팅방 이름 변경됨: ${hashedUid.substring(0, 8)}... - 방 ID: ${roomId}`,
        );
    } catch (error) {
        logger.error("채팅방 이름 변경 오류:", error);
        throw error;
    }
}

export const deleteChatRoom = async (uid, roomId) => {
    try {
        const hashedUid = hashUserId(uid);

        const room = await db("chat_rooms")
            .where({ owner: hashedUid, id: roomId })
            .first();

        if (!room) {
            throw new Error("채팅방을 찾을 수 없습니다");
        }

        await db.transaction(async (trx) => {
            await trx("chat").where({ owner: hashedUid, from: roomId }).del();
            await trx("chat_rooms").where({ owner: hashedUid, id: roomId }).del();
        });

        logger.info(
            `채팅방 삭제됨: ${hashedUid.substring(0, 8)}... - 방 ID: ${roomId}`,
        );
    } catch (error) {
        logger.error("채팅방 삭제 오류:", error);
        throw error;
    }
};

export const getChatRooms = async (uid) => {
  try {
    const hashedUid = hashUserId(uid);
    const rooms = await db("chat_rooms")
      .where({ owner: hashedUid })
      .orderBy("id", "desc");

    return rooms.map((room) => ({
      ...room,
      owner: uid,
      name: decryptData(uid, room.name),
    }));
  } catch (error) {
    logger.error("채팅방 가져오기 오류:", error);
    throw error;
  }
};

export const addChatMessages = async (uid, roomId, userMessage, aiMessage) => {
  try {
    const hashedUid = hashUserId(uid);

    const chatId = await getNextId(hashedUid, "chatId");
    const timestamp = formatDateForMySQL();

    const encryptedUserMessage = encryptData(uid, userMessage);
    const encryptedAiMessage = encryptData(uid, aiMessage);

    await db("chat").insert({
      from: roomId,
      owner: hashedUid,
      id: chatId,
      message: encryptedUserMessage,
      sender: "user",
      created_at: timestamp,
    });

    await db("chat").insert({
      from: roomId,
      owner: hashedUid,
      id: chatId + 1,
      message: encryptedAiMessage,
      sender: "ai",
      created_at: timestamp,
    });

    await db("userid")
      .where({ owner: hashedUid })
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
    logger.error("채팅 메시지 추가 오류:", error);
    throw error;
  }
};

export const getChatMessages = async (uid, roomId) => {
  try {
    const hashedUid = hashUserId(uid);
    const messages = await db("chat")
      .where({ owner: hashedUid, from: roomId })
      .orderBy("id", "asc");

    return messages.map((message) => ({
      ...message,
      owner: uid,
      message: decryptData(uid, message.message),
    }));
  } catch (error) {
    logger.error("채팅 메시지 가져오기 오류:", error);
    throw error;
  }
};
