/**
 * AI 채팅 라우터
 * AI 채팅 기능 및 대화방 관리 API 제공
 */
import { Router } from "express";
import { isAuthenticated, isUserRegistered } from "../../middleware/auth.mjs";
import {
  createChatRoom,
  getChatRooms,
  getChatMessages,
} from "../../models/chatModel.mjs";
import {
  generateAutoResponse,
  generateCustomResponse,
} from "../../services/aiService.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

// 모든 라우트에 인증 및 등록 확인 미들웨어 적용
router.use(isAuthenticated, isUserRegistered);

/**
 * 사용자의 모든 채팅방 목록 조회
 * 인증된 사용자의 채팅방 목록을 반환합니다
 *
 * @route GET /api/ai/getRoomList
 * @returns {object} roomData - 채팅방 목록 배열
 * @example
 * // GET /api/ai/getRoomList
 * // Response: { "roomData": [{"id": 1, "name": "채팅방1", "created_at": "2023-01-01"}] }
 */
router.get("/getRoomList", async (req, res) => {
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
 * 새로운 채팅방 생성
 * 사용자가 지정한 이름으로 새 채팅방을 생성합니다
 *
 * @route POST /api/ai/addRoom
 * @param {string} name - 생성할 채팅방 이름 (필수)
 * @returns {object} 생성된 채팅방 정보와 성공 메시지
 * @example
 * // POST /api/ai/addRoom
 * // Body: { "name": "새 채팅방" }
 * // Response: { "message": "채팅방이 성공적으로 생성되었습니다", "id": 123 }
 */
router.post("/addRoom", async (req, res) => {
  try {
    const { name } = req.body;

    // 필수 필드 검증
    if (!name) {
      logger.warn(`채팅방 생성 실패: 이름 누락`);
      return res.status(400).json({ message: "채팅방 이름은 필수입니다" });
    }

    // 채팅방 생성
    const data = await createChatRoom(req.userId, name);

    logger.verbose(`채팅방 생성 성공 - 사용자: ${req.userId}, 이름: ${name}`);
    res
      .status(200)
      .json({ message: "채팅방이 성공적으로 생성되었습니다", ...data });
  } catch (error) {
    logger.error(`채팅방 생성 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * 특정 채팅방의 모든 메시지 조회
 * 지정된 채팅방 ID의 모든 대화 내역을 반환합니다
 *
 * @route GET /api/ai/getChatInRoom
 * @param {string} from - 채팅방 ID (query parameter, 필수)
 * @returns {object} chatData - 채팅 메시지 배열
 * @example
 * // GET /api/ai/getChatInRoom?from=123
 * // Response: { "chatData": [{"id": 1, "message": "안녕하세요", "sender": "user"}] }
 */
router.get("/getChatInRoom", async (req, res) => {
  try {
    const { from } = req.query;

    // 필수 필드 검증
    if (!from) {
      logger.warn(`채팅 메시지 조회 실패: ID 누락`);
      return res.status(400).json({ message: "채팅방 ID는 필수입니다" });
    }

    // 채팅 메시지 조회
    const chatData = await getChatMessages(req.userId, from);

    logger.verbose(
      `채팅 메시지 조회 성공 - 사용자: ${req.userId}, 채팅방ID: ${from}`,
    );
    res.status(200).json({ chatData });
  } catch (error) {
    logger.error(`채팅 메시지 조회 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * AI 자동 응답 생성
 * 사용자가 입력한 프롬프트에 대한 AI 응답을 생성하고 메시지를 저장합니다
 * 채팅방 ID가 없으면 새 채팅방을 자동으로 생성합니다
 *
 * @route POST /api/ai/auto
 * @param {string} prompt - 사용자가 입력한 프롬프트 (필수)
 * @param {string} [room] - 채팅방 ID (선택사항, 미입력시 자동 생성)
 * @returns {object} response - AI 응답과 채팅방 정보
 * @example
 * // POST /api/ai/auto
 * // Body: { "prompt": "안녕하세요", "room": "123" }
 * // Response: { "response": { "message": "안녕하세요! 무엇을 도와드릴까요?", "room": "123" } }
 */
router.post("/auto", async (req, res) => {
  try {
    const { prompt, room } = req.body;

    // 필수 필드 검증
    if (!prompt) {
      logger.warn(`AI 응답 생성 실패: 프롬프트 누락`);
      return res.status(400).json({ message: "프롬프트는 필수입니다" });
    }

    // AI 응답 생성
    const response = await generateAutoResponse(req.userId, prompt, room);

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
 * 수동 AI 모델 선택 후 응답 생성
 * 사용자가 선택한 특정 AI 모델로 프롬프트에 대한 응답을 생성하고 메시지를 저장합니다
 * 채팅방 ID가 없으면 새 채팅방을 자동으로 생성합니다
 *
 * @route POST /api/ai/custom
 * @param {string} prompt - 사용자가 입력한 프롬프트 (필수)
 * @param {string} [room] - 채팅방 ID (선택사항, 미입력시 자동 생성)
 * @param {string} model - 사용자가 선택한 AI 모델 (필수)
 * @returns {string} message - AI 응답 메시지
 * @example
 * // POST /api/ai/custom
 * // Body: { "prompt": "코딩 질문", "model": "gpt-4", "room": "123" }
 * // Response: { "message": "AI 응답 내용" }
 */
router.post("/custom", async (req, res) => {
  try {
    const { prompt, room, model } = req.body;

    // 필수 필드 검증
    if (!prompt) {
      logger.warn(`AI 응답 생성 실패: 프롬프트 누락`);
      return res.status(400).json({ message: "프롬프트는 필수입니다" });
    }

    // AI 응답 생성
    const response = await generateCustomResponse(
      req.userId,
      prompt,
      model,
      room,
    );

    logger.verbose(
      `AI 응답 생성 성공 - 사용자: ${req.userId}, 채팅방ID: ${room}`,
    );
    res.status(200).json({ message: response });
  } catch (error) {
    logger.error(`AI 응답 생성 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

export default router;
