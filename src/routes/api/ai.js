/**
 * AI 채팅 라우터
 * AI 채팅 기능 및 대화방 관리 API 제공
 */
const express = require("express");
const { isAuthenticated, isUserRegistered } = require("../../middleware/auth");
const {
  createChatRoom,
  getChatRooms,
  addChatMessages,
  getChatMessages,
} = require("../../models/chatModel");
const { generateAutoResponse } = require("../../services/aiService");
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

    logger.verbose(
      `채팅방 목록 조회 성공, 채팅방 수: ${roomData.length}`,
    );
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
    await createChatRoom(req.userId, name);

    logger.verbose(`채팅방 생성 성공 - 사용자: ${req.userId}, 이름: ${name}`);
    res.status(200).json({ message: "채팅방이 성공적으로 생성되었습니다" });
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
 * 자동 AI 응답 생성 및 채팅 메시지 저장 헬퍼 함수
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
const autoAiRequest = async (req, res) => {
  try {
    const { prompt, room } = req.body;

    // 필수 필드 검증
    if (!prompt) {
      logger.warn(`AI 응답 생성 실패: 프롬프트 누락`);
      return res.status(400).json({ message: "프롬프트는 필수입니다" });
    }

    if (!room) {
      logger.warn(`AI 응답 생성 실패: 채팅방 ID 누락`);
      return res.status(400).json({ message: "채팅방 ID는 필수입니다" });
    }

    // AI 응답 생성
    const response = await generateAutoResponse(prompt);

    // AI 응답 텍스트 추출
    const aiResponseText =
      response.choices[0].message.content ||
      "죄송합니다. 응답을 생성하는 데 문제가 발생했습니다. 다시 시도해 주세요.";

    // 메시지 데이터베이스에 저장
    await addChatMessages(req.userId, room, prompt, aiResponseText);

    logger.verbose(`AI 응답 생성 성공 - 사용자: ${req.userId}, 채팅방ID: ${room}`);
    res.status(200).json({ message: aiResponseText });
  } catch (error) {
    logger.error(`AI 응답 생성 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
};

// 호환성을 위해 여러 엔드포인트에 동일한 자동 AI 응답 생성 함수 적용
router.post("/auto", autoAiRequest);
router.post("/gpt4o_m", autoAiRequest);
router.post("/gpt4o", autoAiRequest);
router.post("/gpt41", autoAiRequest);
router.post("/o4-mini", autoAiRequest);

module.exports = router;
