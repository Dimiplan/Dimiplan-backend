/**
 * 채팅 모델
 * 암호화와 함께 모든 채팅/AI 관련 데이터베이스 작업을 처리합니다
 * 채팅방 생성, 대화 내역 관리, 메시지 암호화/복호화 기능을 제공합니다
 *
 * @fileoverview AI 채팅 시스템의 데이터 모델 모듈
 */
import { db } from "../config/db.mjs";
import {
  decryptData,
  encryptData,
  getTimestamp,
  hashUserId,
} from "../utils/crypto.mjs";
import { getNextId } from "../utils/db.mjs";
import logger from "../utils/logger.mjs";

// eslint-disable-next-line jsdoc/require-returns
/**
 * 새로운 채팅방 생성
 * 사용자별로 고유한 ID를 발급하고 방 이름을 암호화하여 새 채팅방을 생성합니다
 * 데이터베이스에는 암호화된 데이터가 저장되고 응답에는 평문 데이터가 반환됩니다
 *
 * @async
 * @function createChatRoom
 * @param {string} uid - 사용자 ID (평문)
 * @param {string} name - 채팅방 이름
 * @returns {Promise<object>} 생성된 채팅방 데이터
 * @returns {string} returns.owner - 사용자 ID (평문)
 * @returns {number} returns.id - 채팅방 ID
 * @returns {string} returns.name - 채팅방 이름 (평문)
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * const newRoom = await createChatRoom('user123', 'AI 채팅방');
 * console.log(newRoom.id); // 1, 2, 3, ...
 */
export const createChatRoom = async (uid, name) => {
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

// eslint-disable-next-line jsdoc/require-returns
/**
 * 복호화된 이름과 함께 사용자의 모든 채팅방 가져오기
 * 사용자의 모든 채팅방을 데이터베이스에서 조회하고 암호화된 방 이름을 복호화하여 반환합니다
 * 최신 순으로 정렬되어 반환됩니다
 *
 * @async
 * @function getChatRooms
 * @param {string} uid - 사용자 ID (평문)
 * @returns {Promise<Array<object>>} 채팅방 객체 배열
 * @returns {string} returns[].owner - 사용자 ID (평문)
 * @returns {number} returns[].id - 채팅방 ID
 * @returns {string} returns[].name - 채팅방 이름 (복호화된 평문)
 * @returns {number} returns[].isProcessing - 처리 상태
 * @returns {string} returns[].created_at - 생성 일시
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * const rooms = await getChatRooms('user123');
 * console.log(rooms[0].name); // '복호화된 채팅방 이름'
 */
export const getChatRooms = async (uid) => {
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

// eslint-disable-next-line jsdoc/require-returns
/**
 * 암호화와 함께 채팅 기록에 메시지 추가
 * 사용자 메시지와 AI 응답을 암호화하여 데이터베이스에 저장합니다
 * 사용자 메시지와 AI 메시지를 순차적으로 저장하고 채팅 ID 카운터를 업데이트합니다
 *
 * @async
 * @function addChatMessages
 * @param {string} uid - 사용자 ID (평문)
 * @param {number} roomId - 채팅방 ID
 * @param {string} userMessage - 사용자 메시지
 * @param {string} aiMessage - AI 응답 메시지
 * @returns {Promise<Array<object>>} 추가된 메시지 객체 배열 (2개: 사용자 + AI)
 * @returns {number} returns[].from - 채팅방 ID
 * @returns {string} returns[].owner - 사용자 ID
 * @returns {number} returns[].id - 메시지 ID
 * @returns {string} returns[].message - 메시지 내용 (평문)
 * @returns {string} returns[].sender - 보낸이 ('user' 또는 'ai')
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * const messages = await addChatMessages('user123', 1, '안녕', '안녕하세요!');
 * console.log(messages[0].sender); // 'user'
 * console.log(messages[1].sender); // 'ai'
 */
export const addChatMessages = async (uid, roomId, userMessage, aiMessage) => {
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

// eslint-disable-next-line jsdoc/require-returns
/**
 * 복호화와 함께 방의 채팅 메시지 가져오기
 * 지정된 채팅방의 모든 메시지를 조회하고 암호화된 메시지 내용을 복호화하여 반환합니다
 * 메시지는 ID 순으로 정렬되어 시간 순서대로 반환됩니다
 *
 * @async
 * @function getChatMessages
 * @param {string} uid - 사용자 ID (평문)
 * @param {number} roomId - 채팅방 ID
 * @returns {Promise<Array<object>>} 채팅 메시지 객체 배열
 * @returns {number} returns[].from - 채팅방 ID
 * @returns {string} returns[].owner - 사용자 ID (평문)
 * @returns {number} returns[].id - 메시지 ID
 * @returns {string} returns[].message - 메시지 내용 (복호화된 평문)
 * @returns {string} returns[].sender - 보낸이 ('user' 또는 'ai')
 * @returns {string} returns[].created_at - 생성 일시
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * const messages = await getChatMessages('user123', 1);
 * messages.forEach(msg => console.log(`${msg.sender}: ${msg.message}`));
 */
export const getChatMessages = async (uid, roomId) => {
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
 * 지정된 채팅방이 존재하는지 확인한 후, 트랜잭션을 사용하여 안전하게 삭제합니다
 * 채팅방과 관련된 모든 메시지를 원자적으로 삭제하여 데이터 일관성을 보장합니다
 *
 * @async
 * @function deleteChatRoom
 * @param {string} uid - 사용자 ID (평문)
 * @param {number} roomId - 삭제할 채팅방 ID
 * @returns {Promise<boolean>} 삭제 성공 여부 (true: 성공)
 * @throws {Error} 채팅방을 찾을 수 없을 때 또는 데이터베이스 오류 시 예외 발생
 * @example
 * try {
 *   const deleted = await deleteChatRoom('user123', 1);
 *   console.log('채팅방 삭제 성공');
 * } catch (error) {
 *   console.error('채팅방을 찾을 수 없습니다');
 * }
 */
export const deleteChatRoom = async (uid, roomId) => {
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
