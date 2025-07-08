/**
 * 플래너 관리 라우터
 * 플래너 생성, 조회, 수정, 삭제 API 제공
 */
import { Router } from "express";
import {
  addPlanner,
  getAllPlanners,
  getPlannerInfo,
  removePlanner,
  updatePlannerName,
} from "../../services/planner.mjs";
import { getTaskList } from "../../services/task.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

router
  .route("/")
  /**
   * @name 모든 플래너 조회
   * @route {GET} /api/planners
   * @returns {number} [].id - 플래너 ID
   * @returns {string} [].name - 플래너 이름
   * @returns {boolean} [].isDaily - 일일 플래너 여부
   * @returns {string} [].from - 플래너 출처
   * @returns {string} [].owner - 소유자 ID
   * @returns {string} [].created_at - 생성 날짜
   * @throws {404} 플래너가 없는 경우
   * @example
   * GET /api/planners
   * Response: [{"id": 1, "name": "플래너1", "isDaily": true}]
   */
  .get(async (req, res) => {
    try {
      const planners = await getAllPlanners(req.userId);
      res.status(200).json(planners);
    } catch (error) {
      if (error.message === "PLANNERS_NOT_FOUND") {
        return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
      }
      logger.error(`플래너 목록 조회 중 오류`, error);
      res.status(500).json({
        message: "플래너 목록 조회 중 오류 발생",
        error: error.message,
      });
    }
  })

  /**
   * @name 새로운 플래너 생성
   * @route {POST} /api/planners
   * @bodyparam {string} name - 플래너 이름
   * @bodyparam {boolean} isDaily - 일일 플래너 여부
   * @returns {string} message - 성공 메시지
   * @example
   * POST /api/planners
   * Body: { "name": "일정 플래너", "isDaily": true}
   */
  .post(async (req, res) => {
    try {
      await addPlanner(req.userId, req.body);
      res.status(201).send();
    } catch (error) {
      if (error.message === "REQUIRED_FIELDS_MISSING") {
        return res.status(400).json({ message: "이름은 필수 입력 항목입니다" });
      }
      logger.error(`플래너 추가 중 오류`, error);
      res.status(500).json({ message: "서버 내부 오류" });
    }
  })

  /**
   * @name 플래너 이름 변경
   * @route {PATCH} /api/planners
   * @bodyparam {string} id - 플래너 ID
   * @bodyparam {string} name - 새 플래너 이름
   * @returns {string} message - 성공 메시지
   * @example
   * PATCH /api/planners
   * Body: { "id": "123", "name": "새로운 이름" }
   */
  .patch(async (req, res) => {
    try {
      await updatePlannerName(req.userId, req.body);
      res.status(204).send();
    } catch (error) {
      if (error.message === "REQUIRED_FIELDS_MISSING") {
        return res
          .status(400)
          .json({ message: "플래너 ID와 이름은 필수입니다" });
      }
      logger.error(`플래너 이름 변경 중 오류`, error);
      res.status(500).json({ message: "서버 내부 오류" });
    }
  })

  /**
   * @name 플래너 삭제
   * @route {DELETE} /api/planners
   * @bodyparam {string} id - 삭제할 플래너 ID
   * @returns {string} message - 성공 메시지
   * @throws {400} 필수 필드가 누락된 경우
   * @throws {404} 플래너를 찾을 수 없는 경우
   * @example
   * POST /api/planners
   * Body: { "id": "123" }
   */
  .delete(async (req, res) => {
    try {
      await removePlanner(req.userId, req.body);
      res.status(204).send();
    } catch (error) {
      if (error.message === "REQUIRED_FIELDS_MISSING") {
        return res.status(400).json({ message: "플래너 ID는 필수입니다" });
      }
      if (error.message === "PLANNER_NOT_FOUND") {
        return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
      }
      logger.error(`플래너 삭제 중 오류`, error);
      res.status(500).json({
        message: "플래너 삭제 중 오류 발생",
        error: error.message,
      });
    }
  });

/**
 * @name 특정 플래너 정보 조회
 * @route {GET} /api/planners/:plannerId/info
 * @routeparam {string} plannerId - 플래너 ID
 * @returns {number} id - 플래너 ID
 * @returns {string} name - 플래너 이름
 * @returns {boolean} isDaily - 일일 플래너 여부
 * @returns {string} from - 플래너 출처
 * @returns {string} owner - 소유자 ID
 * @returns {string} created_at - 생성 날짜
 * @throws {400} 필수 필드가 누락된 경우
 * @throws {404} 플래너를 찾을 수 없는 경우
 * @example
 * GET /api/planners/:plannerId/info
 * Response: { "id": 1, "name": "플래너1", "isDaily": true, "from": "user", "owner": "123", "created_at": "2023-01-01T00:00:00Z" }
 */
router.get("/:plannerId/info", async (req, res) => {
  try {
    const planner = await getPlannerInfo(req.userId, req.params.plannerId);
    res.status(200).json(planner);
  } catch (error) {
    if (error.message === "REQUIRED_FIELDS_MISSING") {
      return res.status(400).json({ message: "잘못된 요청" });
    }
    if (error.message === "PLANNER_NOT_FOUND") {
      return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
    }
    logger.error(`플래너 정보 조회 중 오류`, error);
    res.status(500).json({
      message: "플래너 정보 조회 중 오류 발생",
      error: error.message,
    });
  }
});

/**
 * @name 플래너의 작업 조회
 * @route {GET} /api/planners/:plannerId/tasks
 * @routeparam {string} plannerId - 플래너 ID
 * @queryparam {boolean} [isCompleted] - 완료 상태 필터
 * @returns {string} [].owner - 사용자 ID
 * @returns {string} [].contents - 작업 내용
 * @returns {number} [].id - 작업 ID
 * @returns {number} [].from - 플래너 ID
 * @returns {string} [].startDate - 시작 날짜
 * @returns {string} [].dueDate - 마감 날짜
 * @returns {number} [].priority - 우선순위
 * @returns {number} [].isCompleted - 완료 상태
 * @throws {404} 작업이나 플래너를 찾을 수 없는 경우
 * @example
 * GET /api/planners/:plannerId/tasks?isCompleted=false
 */
router.get("/:plannerId/tasks", async (req, res) => {
  try {
    const { plannerId } = req.params;
    const { isCompleted } = req.query;
    const tasks = await getTaskList(req.userId, plannerId, isCompleted);
    res.status(200).json(tasks);
  } catch (error) {
    if (error.message === "TASKS_NOT_FOUND") {
      return res.status(404).json({ message: "작업을 찾을 수 없습니다" });
    }
    if (error.message === "PLANNER_NOT_FOUND") {
      return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
    }
    logger.error(`작업 조회 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

export default router;
