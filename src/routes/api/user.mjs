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
 * 사용자가 입력한 데이터의 유효성을 검증합니다 (이름 길이, 학년, 반 범위 등)
 * 
 * @param {Object} userData - 검증할 사용자 데이터
 * @param {string} [userData.name] - 사용자 이름 (최대 15자)
 * @param {number} [userData.grade] - 학년 (1-3)
 * @param {number} [userData.class] - 반 (1-6)
 * @returns {boolean} 데이터 유효성 여부
 * @example
 * validateUserData({ name: "홍길동", grade: 1, class: 1 }); // true
 * validateUserData({ name: "너무긴이름입니다1234567890", grade: 1 }); // false
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
 * 사용자 정보 업데이트
 * 프로필 정보 수정 API로 사용자의 이름, 학년, 반, 이메일, 프로필 이미지를 업데이트합니다
 * 
 * @route POST /api/user/update
 * @param {string} [name] - 사용자 이름 (최대 15자)
 * @param {number} [grade] - 학년 (1-3)
 * @param {number} [class] - 반 (1-6)
 * @param {string} [email] - 이메일 주소
 * @param {string} [profile_image] - 프로필 이미지 URL
 * @returns {Object} 업데이트 성공 메시지
 * @example
 * // POST /api/user/update
 * // Body: { "name": "홍길동", "grade": 2, "class": 3 }
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
 * 사용자 등록 상태 확인
 * 사용자의 회원가입 완료 여부를 확인합니다 (이름 설정 여부 기준)
 * 
 * @route GET /api/user/registered
 * @returns {Object} 등록 상태 정보 ({ registered: boolean })
 * @example
 * // GET /api/user/registered
 * // Response: { "registered": true }
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
 * 현재 사용자 정보 조회
 * 로그인된 사용자의 프로필 정보를 반환합니다
 * 
 * @route GET /api/user/get
 * @returns {Object} 사용자 정보 객체
 * @throws {404} 사용자를 찾을 수 없는 경우
 * @example
 * // GET /api/user/get
 * // Response: { "id": "123", "name": "홍길동", "grade": 1, "class": 1, "email": "user@example.com" }
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
