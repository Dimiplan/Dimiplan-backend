/**
 * 사용자 라우터
 * 사용자 정보 관리 및 업데이트 API
 */
import { Router } from "express";
import { getUser, isRegistered, updateUser } from "../../models/userModel.mjs";
import { isAuthenticated } from "../../middleware/auth.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

/**
 * 사용자 데이터 유효성 검사
 * @param {Object} userData - 검증할 사용자 데이터
 * @returns {boolean} 데이터 유효성 여부
 */
const validateUserData = (userData) => {
  // 이름 길이 검증 (최대 15자)
  if (userData.name && userData.name.toString().length > 15) {
    return false;
  }

  // 학년 검증 (1~3학년)
  if (
    userData.grade &&
    (isNaN(parseInt(userData.grade)) ||
      parseInt(userData.grade) > 3 ||
      parseInt(userData.grade) < 1)
  ) {
    return false;
  }

  // 반 검증 (1~6반)
  if (
    userData.class &&
    (isNaN(parseInt(userData.class)) ||
      parseInt(userData.class) > 6 ||
      parseInt(userData.class) < 1)
  ) {
    return false;
  }

  return true;
};

/**
 * @route POST /api/user/update
 * @desc 사용자 정보 업데이트
 * 프로필 정보 수정 API
 */
router.post("/update", isAuthenticated, async (req, res) => {
  try {
    const { name, grade, class: classInput, email, profile_image } = req.body;

    // 입력 데이터 처리
    const userData = {
      name: name ? name.toString() : undefined,
      grade: grade ? parseInt(grade) : undefined,
      class: classInput ? parseInt(classInput) : undefined,
      email: email ? email.toString() : undefined,
      profile_image: profile_image ? profile_image.toString() : undefined,
    };

    // 데이터 유효성 검사
    if (!validateUserData(userData)) {
      logger.warn("유효하지 않은 사용자 데이터");
      return res.status(400).json({ message: "잘못된 요청" });
    }

    // 유효한 필드만 추출
    const cleanedData = Object.keys(userData).reduce((acc, key) => {
      if (userData[key] !== undefined) {
        acc[key] = userData[key];
      }
      return acc;
    }, {});

    // 업데이트할 필드 확인
    if (Object.keys(cleanedData).length === 0) {
      logger.warn("업데이트할 필드 없음");
      return res.status(400).json({ message: "업데이트할 필드가 없습니다" });
    }

    // 사용자 정보 업데이트
    await updateUser(req.userId, cleanedData);

    logger.verbose(`사용자 ${req.userId} 정보 업데이트 완료`);
    res.status(200).json({ message: "업데이트 완료" });
  } catch (error) {
    logger.error("사용자 정보 업데이트 중 오류:", error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @route GET /api/user/registered
 * @desc 사용자 등록 상태 확인
 * 사용자의 회원가입 완료 여부 확인
 */
router.get("/registered", isAuthenticated, async (req, res) => {
  try {
    const registered = await isRegistered(req.userId);
    logger.verbose(`사용자 ${req.userId} 등록 상태: ${registered}`);
    res.status(registered ? 200 : 410).json({ registered });
  } catch (error) {
    logger.error("등록 상태 확인 중 오류:", error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @route GET /api/user/get
 * @desc 현재 사용자 정보 조회
 * 로그인된 사용자의 프로필 정보 반환
 */
router.get("/get", isAuthenticated, async (req, res) => {
  try {
    const user = await getUser(req.userId);

    if (!user) {
      logger.warn(`사용자 ${req.userId} 정보 없음`);
      return res.status(404).json({ message: "사용자를 찾을 수 없음" });
    }

    logger.verbose(`사용자 ${req.userId} 정보 조회 성공`);
    res.status(200).json(user);
  } catch (error) {
    logger.error("사용자 정보 조회 중 오류:", error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

export default router;
