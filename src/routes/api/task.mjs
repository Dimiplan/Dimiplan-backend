/**
 * 작업(Task) 관련 라우터
 * 작업 생성, 조회, 수정, 삭제 API 제공
 */
import { Router } from "express";
import { isAuthenticated, isUserRegistered } from "../../middleware/auth.mjs";
import {
  addTask,
  updateTaskInfo,
  removeTask,
  markTaskComplete,
  getTaskList,
} from "../../services/taskService.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

// 모든 라우트에 인증 및 등록 확인 미들웨어 적용
router.use(isAuthenticated, isUserRegistered);

/**
 * 새로운 작업 생성
 * 사용자의 작업 추가 요청을 처리하여 새 작업을 생성합니다
 *
 * @route POST /api/task/add
 * @param {string} contents - 작업 내용 (필수)
 * @param {number} priority - 작업 우선순위
 * @param {string} from - 작업 출처 (필수)
 * @param {string} startDate - 시작 날짜
 * @param {string} dueDate - 마감 날짜
 * @returns {object} 성공 메시지
 * @throws {404} 플래너를 찾을 수 없는 경우
 */
router.post("/add", async (req, res) => {
  try {
    await addTask(req.userId, req.body);
    res.status(201).json({ message: "작업이 성공적으로 추가되었습니다" });
  } catch (error) {
    if (error.message === "REQUIRED_FIELDS_MISSING") {
      return res
        .status(400)
        .json({ message: "내용과 출처는 필수 입력 항목입니다" });
    }
    if (error.message === "PLANNER_NOT_FOUND") {
      return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
    }
    logger.error(`작업 추가 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * 작업 정보 수정
 * 사용자의 작업 정보 업데이트 요청을 처리합니다
 *
 * @route POST /api/task/update
 * @param {string} id - 작업 ID (필수)
 * @param {string} [contents] - 수정할 작업 내용
 * @param {number} [priority] - 수정할 우선순위
 * @param {string} [from] - 수정할 출처
 * @param {string} [startDate] - 수정할 시작 날짜
 * @param {string} [dueDate] - 수정할 마감 날짜
 * @param {boolean} [isCompleted] - 수정할 완료 상태
 * @returns {object} 성공 메시지
 * @throws {404} 작업을 찾을 수 없는 경우
 */
router.post("/update", async (req, res) => {
  try {
    await updateTaskInfo(req.userId, req.body);
    res.status(200).json({ message: "작업이 성공적으로 업데이트되었습니다" });
  } catch (error) {
    if (error.message === "REQUIRED_FIELDS_MISSING") {
      return res.status(400).json({ message: "작업 ID는 필수입니다" });
    }
    if (error.message === "NO_UPDATE_DATA") {
      return res
        .status(400)
        .json({ message: "업데이트할 데이터가 필요합니다" });
    }
    if (error.message === "TASK_NOT_FOUND") {
      return res.status(404).json({ message: "작업을 찾을 수 없습니다" });
    }
    logger.error(`작업 업데이트 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * 작업 삭제
 * 사용자의 작업 삭제 요청을 처리합니다
 *
 * @route POST /api/task/delete
 * @param {string} id - 삭제할 작업 ID (필수)
 * @returns {object} 성공 메시지
 * @throws {404} 작업을 찾을 수 없는 경우
 */
router.post("/delete", async (req, res) => {
  try {
    await removeTask(req.userId, req.body);
    res.status(200).json({ message: "작업이 성공적으로 삭제되었습니다" });
  } catch (error) {
    if (error.message === "REQUIRED_FIELDS_MISSING") {
      return res.status(400).json({ message: "작업 ID는 필수입니다" });
    }
    if (error.message === "TASK_NOT_FOUND") {
      return res.status(404).json({ message: "작업을 찾을 수 없습니다" });
    }
    logger.error(`작업 삭제 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * 작업 완료 표시
 * 사용자의 작업 완료 요청을 처리합니다
 *
 * @route POST /api/task/complete
 * @param {string} id - 완료 처리할 작업 ID (필수)
 * @returns {object} 성공 메시지
 * @throws {404} 작업을 찾을 수 없는 경우
 */
router.post("/complete", async (req, res) => {
  try {
    await markTaskComplete(req.userId, req.body);
    res.status(200).json({ message: "작업이 성공적으로 완료되었습니다" });
  } catch (error) {
    if (error.message === "REQUIRED_FIELDS_MISSING") {
      return res.status(400).json({ message: "작업 ID는 필수입니다" });
    }
    if (error.message === "TASK_NOT_FOUND") {
      return res.status(404).json({ message: "작업을 찾을 수 없습니다" });
    }
    logger.error(`작업 완료 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * 작업 조회
 * 사용자의 전체 작업 또는 특정 플래너의 작업을 조회합니다
 *
 * @route GET /api/task/get
 * @param {string} [id] - 플래너 ID (query parameter, 선택사항)
 * @param {boolean} [isCompleted] - 완료 상태 필터 (query parameter)
 * @returns {Array} 작업 목록 배열
 * @throws {404} 작업이나 플래너를 찾을 수 없는 경우
 * @example
 * // GET /api/task/get?id=123&isCompleted=false
 */
router.get("/get", async (req, res) => {
  try {
    const { id, isCompleted } = req.query;
    const tasks = await getTaskList(req.userId, id, isCompleted);
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
