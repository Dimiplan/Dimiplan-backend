/**
 * AI 채팅 라우터
 * AI 채팅 기능 및 대화방 관리 API 제공
 */
const express = require("express");
const { isAuthenticated, isUserRegistered } = require("../../middleware/auth");
const {
  createChatRoom,
  getChatRooms,
  getChatMessages,
} = require("../../models/chatModel");
const {
  generateAutoResponse,
  generateCustomResponse,
} = require("../../services/aiService");
const logger = require("../../utils/logger");

const router = express.Router();

// 모든 라우트에 인증 및 등록 확인 미들웨어 적용
router.use(isAuthenticated, isUserRegistered);

/**
 * @route GET /api/ai/getRoomList
 * @desc 사용자의 모든 채팅방 목록 조회
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
 * @route POST /api/ai/addRoom
 * @desc 새로운 채팅방 생성
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
 * @route GET /api/ai/getChatInRoom
 * @desc 특정 채팅방의 모든 메시지 조회
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
 * @route POST /api/ai/auto
 * @desc AI 자동 응답 생성
 * 사용자가 입력한 프롬프트에 대한 AI 응답 생성 및 메시지 저장
 * @param {string} prompt - 사용자가 입력한 프롬프트
 * @param {string | undefined} room - 채팅방 ID (미입력시 자동 생성)
 * @returns {string} message - AI 응답 메시지
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
      `AI 응답 생성 성공 - 사용자: ${req.userId}, 채팅방ID: ${room}`,
    );
    res.status(200).json({ message: response });
  } catch (error) {
    logger.error(`AI 응답 생성 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @route POST /api/ai/custom
 * @desc 수동 AI 모델 선택 후 응답 생성
 * 사용자가 입력한 프롬프트에 대한 AI 응답 생성 및 메시지 저장
 * @param {string} prompt - 사용자가 입력한 프롬프트
 * @param {string | undefined} room - 채팅방 ID (미입력시 자동 생성)
 * @param {string} model - 사용자가 선택한 AI 모델
 * @returns {string} message - AI 응답 메시지
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

module.exports = router;
