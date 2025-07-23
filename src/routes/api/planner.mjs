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

/**
 * @name 모든 플래너 조회
 * @route {GET} /api/planners
 * @returns {number} [].id - 플래너 ID
 * @returns {string} [].name - 플래너 이름
 * @returns {boolean} [].isDaily - 일일 플래너 여부
 * @returns {string} [].from - 플래너 출처
 * @returns {string} [].owner - 소유자 ID
 * @returns {string} [].created_at - 생성 날짜
 */
router.get("/", async (req, res) => {
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
});

/**
 * @name 새로운 플래너 생성
 * @route {POST} /api/planners
 * @bodyparam {string} name - 플래너 이름
 * @bodyparam {boolean} isDaily - 일일 플래너 여부
 * @returns {string} message - 성공 메시지
 */
router.post("/", async (req, res) => {
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
});

/**
 * @name 플래너 이름 변경
 * @route {PATCH} /api/planners/:plannerId
 * @routeparam {string} plannerId - 플래너 ID
 * @bodyparam {string} name - 새 플래너 이름
 * @returns {string} message - 성공 메시지
 */
router.patch("/:plannerId", async (req, res) => {
  try {
    await updatePlannerName(req.userId, req.params.plannerId, req.body.name);
    res.status(204).send();
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
 * @route {DELETE} /api/planners/:plannerId
 * @routeparam {string} plannerId - 삭제할 플래너 ID
 * @returns {string} message - 성공 메시지
 */
router.delete("/:plannerId", async (req, res) => {
  try {
    await removePlanner(req.userId, req.params.plannerId);
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
 */
router.get("/:plannerId/tasks", async (req, res) => {
  try {
    const { plannerId } = req.params;
    const { isCompleted } = req.query;
    const tasks = await getTaskList(req.userId, plannerId, isCompleted);
    res.status(200).json(tasks);
  } catch (error) {
    if (error.message === "TASKS_NOT_FOUND") {
      return res.status(204).send("작업이 없습니다");
    }
    if (error.message === "PLANNER_NOT_FOUND") {
      return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
    }
    logger.error(`작업 조회 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

export default router;
