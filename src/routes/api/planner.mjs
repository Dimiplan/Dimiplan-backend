/**
 * 플래너 관리 라우터
 * 플래너 생성, 조회, 수정, 삭제 API 제공
 */
import { Router } from "express";
import { isAuthenticated, isUserRegistered } from "../../middleware/auth.mjs";
import {
  addPlanner,
  updatePlannerName,
  removePlanner,
  getPlannerInfo,
  getAllPlanners,
} from "../../services/plannerService.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

// 모든 라우트에 인증 및 등록 확인 미들웨어 적용
router.use(isAuthenticated, isUserRegistered);

/**
 * @name 새로운 플래너 생성
 * @route {POST} /api/planner/add
 * @bodyparam {string} name - 플래너 이름 (필수)
 * @bodyparam {boolean} isDaily - 일일 플래너 여부
 * @bodyparam {string} from - 플래너 출처 (필수)
 * @returns {object} 성공 메시지
 * @example
 * POST /api/planner/add
 * Body: { "name": "일정 플래너", "isDaily": true, "from": "web" }
 */
router.post("/add", async (req, res) => {
  try {
    await addPlanner(req.userId, req.body);
    res.status(201).json({ message: "플래너가 성공적으로 추가되었습니다" });
  } catch (error) {
    if (error.message === "REQUIRED_FIELDS_MISSING") {
      return res
        .status(400)
        .json({ message: "이름과 출처는 필수 입력 항목입니다" });
    }
    logger.error(`플래너 추가 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @name 플래너 이름 변경
 * @route {POST} /api/planner/rename
 * @bodyparam {string} id - 플래너 ID (필수)
 * @bodyparam {string} name - 새 플래너 이름 (필수)
 * @returns {object} 성공 메시지
 * @example
 * POST /api/planner/rename
 * Body: { "id": "123", "name": "새로운 이름" }
 */
router.post("/rename", async (req, res) => {
  try {
    await updatePlannerName(req.userId, req.body);
    res
      .status(200)
      .json({ message: "플래너 이름이 성공적으로 변경되었습니다" });
  } catch (error) {
    if (error.message === "REQUIRED_FIELDS_MISSING") {
      return res.status(400).json({ message: "플래너 ID와 이름은 필수입니다" });
    }
    logger.error(`플래너 이름 변경 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @name 플래너 삭제
 * @route {POST} /api/planner/delete
 * @bodyparam {string} id - 삭제할 플래너 ID (필수)
 * @returns {object} 성공 메시지
 * @throws {404} 플래너를 찾을 수 없는 경우
 * @example
 * POST /api/planner/delete
 * Body: { "id": "123" }
 */
router.post("/delete", async (req, res) => {
  try {
    await removePlanner(req.userId, req.body);
    res.status(200).json({
      message: "플래너와 관련된 모든 플랜이 성공적으로 삭제되었습니다",
    });
  } catch (error) {
    if (error.message === "REQUIRED_FIELDS_MISSING") {
      return res.status(400).json({ message: "플래너 ID는 필수입니다" });
    }
    if (error.message === "PLANNER_NOT_FOUND") {
      return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
    }
    logger.error(`플래너 삭제 중 오류`, error);
    res
      .status(500)
      .json({ message: "플래너 삭제 중 오류 발생", error: error.message });
  }
});

/**
 * @name 특정 플래너 정보 조회
 * @route {GET} /api/planner/getInfo
 * @queryparam {string} id - 플래너 ID (query parameter, 필수)
 * @returns {object} 플래너 상세 정보
 * @throws {404} 플래너를 찾을 수 없는 경우
 * @example
 * GET /api/planner/getInfo?id=123
 */
router.get("/getInfo", async (req, res) => {
  try {
    const planner = await getPlannerInfo(req.userId, req.query.id);
    res.status(200).json(planner);
  } catch (error) {
    if (error.message === "REQUIRED_FIELDS_MISSING") {
      return res.status(400).json({ message: "잘못된 요청" });
    }
    if (error.message === "PLANNER_NOT_FOUND") {
      return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
    }
    logger.error(`플래너 정보 조회 중 오류`, error);
    res
      .status(500)
      .json({ message: "플래너 정보 조회 중 오류 발생", error: error.message });
  }
});

/**
 * @name 모든 플래너 조회
 * @route {GET} /api/planner/getPlanners
 * @returns {Array} 플래너 목록 배열
 * @throws {404} 플래너가 없는 경우
 * @example
 * GET /api/planner/getPlanners
 * Response: [{"id": 1, "name": "플래널1", "isDaily": true}]
 */
router.get("/getPlanners", async (req, res) => {
  try {
    const planners = await getAllPlanners(req.userId);
    res.status(200).json(planners);
  } catch (error) {
    if (error.message === "PLANNERS_NOT_FOUND") {
      return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
    }
    logger.error(`플래너 목록 조회 중 오류`, error);
    res
      .status(500)
      .json({ message: "플래너 목록 조회 중 오류 발생", error: error.message });
  }
});

export default router;
