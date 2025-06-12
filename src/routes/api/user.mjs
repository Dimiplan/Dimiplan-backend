/**
 * 사용자 라우터
 * 사용자 정보 관리 및 업데이트 API
 */
import { Router } from "express";
import { isAuthenticated } from "../../middleware/auth.mjs";
import {
  updateUserInfo,
  checkUserRegistration,
  getUserInfo,
} from "../../services/userService.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

/**
 * @name 사용자 정보 업데이트
 * @route {POST} /api/user/update
 * @param {string} [name] - 사용자 이름 (최대 15자)
 * @param {number} [grade] - 학년 (1-3)
 * @param {number} [class] - 반 (1-6)
 * @param {string} [email] - 이메일 주소
 * @param {string} [profile_image] - 프로필 이미지 URL
 * @returns {object} 업데이트 성공 메시지
 * @example
 * // POST /api/user/update
 * // Body: { "name": "홍길동", "grade": 2, "class": 3 }
 */
router.post("/update", isAuthenticated, async (req, res) => {
  try {
    await updateUserInfo(req.userId, req.body);
    res.status(200).json({ message: "업데이트 완료" });
  } catch (error) {
    if (error.message === "INVALID_DATA") {
      return res.status(400).json({ message: "잘못된 요청" });
    }
    if (error.message === "NO_UPDATE_FIELDS") {
      return res.status(400).json({ message: "업데이트할 필드가 없습니다" });
    }
    logger.error("사용자 정보 업데이트 중 오류:", error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @name 사용자 등록 상태 확인
 * @route {GET} /api/user/registered
 * @returns {object} 등록 상태 정보 ({ registered: boolean })
 * @example
 * // GET /api/user/registered
 * // Response: { "registered": true }
 */
router.get("/registered", isAuthenticated, async (req, res) => {
  try {
    const result = await checkUserRegistration(req.userId);
    res.status(result.registered ? 200 : 410).json(result);
  } catch (error) {
    logger.error("등록 상태 확인 중 오류:", error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @name 현재 사용자 정보 조회
 * @route {GET} /api/user/get
 * @returns {object} 사용자 정보 객체
 * @throws {404} 사용자를 찾을 수 없는 경우
 * @example
 * // GET /api/user/get
 * // Response: { "id": "123", "name": "홍길동", "grade": 1, "class": 1, "email": "user@example.com" }
 */
router.get("/get", isAuthenticated, async (req, res) => {
  try {
    const user = await getUserInfo(req.userId);
    res.status(200).json(user);
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ message: "사용자를 찾을 수 없음" });
    }
    logger.error("사용자 정보 조회 중 오류:", error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

export default router;
