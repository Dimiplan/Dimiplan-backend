/**
 * 채팅 모델
 * 암호화와 함께 모든 채팅/AI 관련 데이터베이스 작업을 처리합니다
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
 * 새로운 채팅방 생성
 * @param {string} uid - 사용자 ID
 * @param {string} name - 방 이름
 * @returns {Promise<Object>} - 생성된 방 데이터
 */
const createChatRoom = async (uid, name) => {
  try {
    const hashedUid = hashUserId(uid);
    const roomId = await getNextId(hashedUid, "roomId");

    // 방 이름 암호화
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
      name: name, // 응답용 평문 반환
    };
  } catch (error) {
    logger.error("채팅방 생성 오류:", error);
    throw error;
  }
};

/**
 * 복호화된 이름과 함께 사용자의 모든 채팅방 가져오기
 * @param {string} uid - 사용자 ID
 * @returns {Promise<Array>} - 채팅방 객체 배열
 */
const getChatRooms = async (uid) => {
  try {
    const hashedUid = hashUserId(uid);
    const rooms = await db("chat_rooms")
        .where({ owner: hashedUid })
        .orderBy("id", "desc");

    // 방 이름 복호화
    return rooms.map((room) => ({
      ...room,
      owner: uid, // 애플리케이션 로직을 위해 원본 ID 사용
      name: decryptData(uid, room.name),
    }));
  } catch (error) {
    logger.error("채팅방 가져오기 오류:", error);
    throw error;
  }
};

/**
 * 암호화와 함께 채팅 기록에 메시지 추가
 * @param {string} uid - 사용자 ID
 * @param {number} roomId - 방 ID
 * @param {string} userMessage - 사용자 메시지
 * @param {string} aiMessage - AI 응답 메시지
 * @returns {Promise<Array>} - 추가된 메시지 객체
 */
const addChatMessages = async (uid, roomId, userMessage, aiMessage) => {
  try {
    const hashedUid = hashUserId(uid);

    // 다음 채팅 ID 가져오기
    const chatId = await getNextId(hashedUid, "chatId");
    const timestamp = getTimestamp();

    // 메시지 암호화
    const encryptedUserMessage = encryptData(uid, userMessage);
    const encryptedAiMessage = encryptData(uid, aiMessage);

    // 사용자 메시지 추가
    await db("chat").insert({
      from: roomId,
      owner: hashedUid,
      id: chatId,
      message: encryptedUserMessage,
      sender: "user",
      created_at: timestamp,
    });

    // AI 응답 추가
    await db("chat").insert({
      from: roomId,
      owner: hashedUid,
      id: chatId + 1,
      message: encryptedAiMessage,
      sender: "ai",
      created_at: timestamp,
    });

    // 채팅 ID 카운터 업데이트
    await db("userid")
        .where({ owner: hashedUid })
        .update({ chatId: chatId + 2 });

    // 응답용 평문 메시지 반환
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

/**
 * 복호화와 함께 방의 채팅 메시지 가져오기
 * @param {string} uid - 사용자 ID
 * @param {number} roomId - 방 ID
 * @returns {Promise<Array>} - 채팅 메시지 객체 배열
 */
const getChatMessages = async (uid, roomId) => {
  try {
    const hashedUid = hashUserId(uid);
    const messages = await db("chat")
        .where({ owner: hashedUid, from: roomId })
        .orderBy("id", "asc");

    // 메시지 내용 복호화
    return messages.map((message) => ({
      ...message,
      owner: uid, // 애플리케이션 로직을 위해 원본 ID 사용
      message: decryptData(uid, message.message),
    }));
  } catch (error) {
    logger.error("채팅 메시지 가져오기 오류:", error);
    throw error;
  }
};

/**
 * 채팅방과 그 안의 모든 메시지 삭제
 * @param {string} uid - 사용자 ID
 * @param {number} roomId - 방 ID
 * @returns {Promise<boolean>} - 성공 상태
 */
const deleteChatRoom = async (uid, roomId) => {
  try {
    const hashedUid = hashUserId(uid);

    // 방이 존재하는지 확인
    const room = await db("chat_rooms")
        .where({ owner: hashedUid, id: roomId })
        .first();

    if (!room) {
      throw new Error("채팅방을 찾을 수 없습니다");
    }

    // 모든 작업이 함께 성공 또는 실패하도록 트랜잭션으로 실행
    await db.transaction(async (trx) => {
      // 방의 모든 메시지 삭제
      await trx("chat").where({ owner: hashedUid, from: roomId }).del();

      // 방 삭제
      await trx("chat_rooms").where({ owner: hashedUid, id: roomId }).del();
    });

    logger.info(
        `채팅방 삭제됨: ${hashedUid.substring(0, 8)}... - 방 ID: ${roomId}`,
    );
    return true;
  } catch (error) {
    logger.error("채팅방 삭제 오류:", error);
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