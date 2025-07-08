/**
 * 작업(Task) 관련 라우터
 * 작업 생성, 조회, 수정, 삭제 API 제공
 */
import { Router } from "express";
import { addTask, removeTask, updateTaskInfo } from "../../services/task.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

/**
 * @name 새로운 작업 생성
 * @route {POST} /api/tasks
 * @bodyparam {string} contents - 작업 내용
 * @bodyparam {number} priority - 작업 우선순위
 * @bodyparam {string} from - 플래너 ID
 * @bodyparam {string} startDate - 시작 날짜
 * @bodyparam {string} dueDate - 마감 날짜
 * @returns {string} message - 성공 메시지
 * @throws {404} 플래너를 찾을 수 없는 경우
 */
router.post("/", async (req, res) => {
  try {
    await addTask(req.userId, req.body);
    res.status(201).json({ message: "작업이 성공적으로 추가되었습니다" });
  } catch (error) {
    if (error.message === "REQUIRED_FIELDS_MISSING") {
      return res
        .status(400)
        .json({ message: "내용과 플래너 ID는 필수 입력 항목입니다" });
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
 * @route {PATCH} /api/tasks/:taskId
 * @routeparam {string} taskId - 작업 ID
 * @bodyparam {string} [contents] - 수정할 작업 내용
 * @bodyparam {number} [priority] - 수정할 우선순위
 * @bodyparam {string} [from] - 수정할 출처
 * @bodyparam {string} [startDate] - 수정할 시작 날짜
 * @bodyparam {string} [dueDate] - 수정할 마감 날짜
 * @bodyparam {boolean} [isCompleted] - 수정할 완료 상태
 * @returns {string} message - 성공 메시지
 * @throws {404} 작업을 찾을 수 없는 경우
 */
router.patch("/:taskId", async (req, res) => {
  try {
    await updateTaskInfo(req.userId, req.params.taskId, req.body);
    res.status(200).json({
      message: "작업이 성공적으로 업데이트되었습니다",
    });
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
 * @route {DELETE} /api/tasks/:taskId
 * @routeparam {string} taskId - 삭제할 작업 ID
 * @returns {string} message - 성공 메시지
 * @throws {404} 작업을 찾을 수 없는 경우
 */
router.delete("/:taskId", async (req, res) => {
  try {
    await removeTask(req.userId, req.params.taskId);
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

export default router;
