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
 * @name 새로운 작업 생성
 * @route {POST} /api/task/add
 * @bodyparam {string} contents - 작업 내용 (필수)
 * @bodyparam {number} priority - 작업 우선순위
 * @bodyparam {string} from - 작업 출처 (필수)
 * @bodyparam {string} startDate - 시작 날짜
 * @bodyparam {string} dueDate - 마감 날짜
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
 * @name 작업 정보 수정
 * @route {POST} /api/task/update
 * @bodyparam {string} id - 작업 ID (필수)
 * @bodyparam {string} [contents] - 수정할 작업 내용
 * @bodyparam {number} [priority] - 수정할 우선순위
 * @bodyparam {string} [from] - 수정할 출처
 * @bodyparam {string} [startDate] - 수정할 시작 날짜
 * @bodyparam {string} [dueDate] - 수정할 마감 날짜
 * @bodyparam {boolean} [isCompleted] - 수정할 완료 상태
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
 * @name 작업 삭제
 * @route {POST} /api/task/delete
 * @bodyparam {string} id - 삭제할 작업 ID (필수)
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
 * @name 작업 완료 표시
 * @route {POST} /api/task/complete
 * @bodyparam {string} id - 완료 처리할 작업 ID (필수)
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
 * @name 작업 조회
 * @route {GET} /api/task/get
 * @queryparam {string} [id] - 플래너 ID (query parameter, 선택사항)
 * @queryparam {boolean} [isCompleted] - 완료 상태 필터 (query parameter)
 * @returns {Array} 작업 목록 배열
 * @throws {404} 작업이나 플래너를 찾을 수 없는 경우
 * @example
 * GET /api/task/get?id=123&isCompleted=false
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
