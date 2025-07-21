import { Router } from "express";
import { getUserInfo, updateUserInfo } from "../../services/user.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

/**
 * @name 현재 사용자 정보 조회
 * @route {GET} /api/user
 * @returns {string} id - 사용자 ID
 * @returns {string} name - 사용자 이름
 * @returns {number} grade - 학년
 * @returns {number} class - 반
 * @returns {string} email - 이메일 주소
 * @returns {string} profile_image - 프로필 이미지 URL
 */
router.get("/", async (req, res) => {
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

/**
 * @name 사용자 정보 업데이트
 * @route {PATCH} /api/user
 * @bodyparam {string} [name] - 사용자 이름 (최대 15자)
 * @bodyparam {number} [grade] - 학년 (1-3)
 * @bodyparam {number} [class] - 반 (1-6)
 * @bodyparam {string} [email] - 이메일 주소
 * @bodyparam {string} [profile_image] - 프로필 이미지 URL
 * @returns {string} message - 업데이트 성공 메시지
 */
router.patch("/", async (req, res) => {
  try {
    await updateUserInfo(req.userId, req.body);
    return res.status(204);
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

export default router;
