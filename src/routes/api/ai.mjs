import { Router } from "express";
import {
  createChatRoom,
  getChatMessages,
  getChatRooms,
} from "../../models/chat.mjs";
import {
  FREE_MODELS,
  generateAutoResponse,
  generateCustomResponse,
} from "../../services/ai.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

/**
 * @name 사용자의 모든 채팅방 목록 조회
 * @route {GET} /api/ai/rooms
 * @returns {number} roomData[].id - 채팅방 ID
 * @returns {string} roomData[].name - 채팅방 이름
 * @returns {string} roomData[].created_at - 생성 날짜
 * @returns {string} roomData[].owner - 소유자 ID
 */
router.get("/rooms", async (req, res) => {
  try {
    const roomData = await getChatRooms(req.userId);

    logger.verbose(`채팅방 목록 조회 성공, 채팅방 수: ${roomData.length}`);
    res.status(200).json({ roomData });
  } catch (error) {
    logger.error(`채팅방 목록 조회 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @name 새로운 채팅방 생성
 * @route {POST} /api/ai/rooms
 * @bodyparam {string} name - 생성할 채팅방 이름
 * @returns {string} message - 성공 메시지
 * @returns {number} id - 생성된 채팅방 ID
 */
router.post("/rooms", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      logger.warn(`채팅방 생성 실패: 이름 누락`);
      return res.status(400).json({ message: "채팅방 이름은 필수입니다" });
    }

    const data = await createChatRoom(req.userId, name);

    logger.verbose(`채팅방 생성 성공 - 사용자: ${req.userId}, 이름: ${name}`);
    res.status(200).json({
      message: "채팅방이 성공적으로 생성되었습니다",
      ...data,
    });
  } catch (error) {
    logger.error(`채팅방 생성 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @name AI 모델 목록 조회(유료 사용자일 경우 유료 모델도 표시 예정)
 * @route {GET} /api/ai
 * @returns {string} model[] - 모델 이름
 */
router.get("/", async (req, res) => {
  res.status(200).json({ model: FREE_MODELS });
});

/**
 * @name 특정 채팅방의 모든 메시지 조회
 * @route {GET} /api/ai/rooms/:roomId
 * @returns {number} chatData[].id - 메시지 ID
 * @returns {string} chatData[].message - 메시지 내용
 * @returns {string} chatData[].sender - 보낸이 (user/ai)
 * @returns {string} chatData[].timestamp - 메시지 시간
 * @returns {string} chatData[].room - 채팅방 ID
 */
router.get("/rooms/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      logger.warn(`채팅 메시지 조회 실패: ID 누락`);
      return res.status(400).json({ message: "채팅방 ID는 필수입니다" });
    }

    const chatData = await getChatMessages(req.userId, roomId);

    logger.verbose(
      `채팅 메시지 조회 성공 - 사용자: ${req.userId}, 채팅방ID: ${roomId}`,
    );
    res.status(200).json({ chatData });
  } catch (error) {
    logger.error(`채팅 메시지 조회 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @name AI 자동 응답 생성
 * @route {POST} /api/ai/auto
 * @bodyparam {string} prompt - 사용자가 입력한 프롬프트
 * @bodyparam {string} [room] - 채팅방 ID
 * @bodyparam {boolean} [search] - 검색 포함 여부
 * @returns {string} response.message - AI 응답 메시지
 * @returns {string} response.room - 채팅방 ID
 * @returns {string} response.timestamp - 응답 시간
 */
router.post("/auto", async (req, res) => {
  try {
    const { prompt, room, search } = req.body;

    if (!prompt) {
      logger.warn(`AI 응답 생성 실패: 프롬프트 누락`);
      return res.status(400).json({ message: "프롬프트는 필수입니다" });
    }

    const response = await generateAutoResponse(
      req.userId,
      prompt,
      room,
      search,
    );

    logger.verbose(
      `AI 응답 생성 성공 - 사용자: ${req.userId}, 채팅방ID: ${response.room}`,
    );

    res.status(200).json({ response });
  } catch (error) {
    logger.error(`AI 응답 생성 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @name 수동 AI 모델 선택 후 응답 생성
 * @route {POST} /api/ai/custom
 * @bodyparam {string} prompt - 사용자가 입력한 프롬프트
 * @bodyparam {string} [room] - 채팅방 ID
 * @bodyparam {string} model - 사용자가 선택한 AI 모델
 * @bodyparam {boolean} [search] - 검색 포함 여부
 * @returns {string} message - AI 응답 메시지
 * @returns {string} room - 채팅방 ID
 */
router.post("/custom", async (req, res) => {
  try {
    const { prompt, room, model, search } = req.body;

    if (!prompt) {
      logger.warn(`AI 응답 생성 실패: 프롬프트 누락`);
      return res.status(400).json({ message: "프롬프트는 필수입니다" });
    }

    const response = await generateCustomResponse(
      req.userId,
      prompt,
      model,
      room,
      search,
    );

    logger.verbose(
      `AI 응답 생성 성공 - 사용자: ${req.userId}, 채팅방ID: ${response.room}`,
    );
    res.status(200).json({ message: response.text, room: response.room });
  } catch (error) {
    if (error.message === "선택된 모델이 목록에 없습니다") {
      logger.warn(`AI 응답 생성 실패: ${error.message}`);
      return res.status(400).json({ message: error.message });
    }
    logger.error(`AI 응답 생성 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

export default router;
