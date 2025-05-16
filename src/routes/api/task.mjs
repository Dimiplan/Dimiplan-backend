/**
 * 작업(Task) 관련 라우터
 * 작업 생성, 조회, 수정, 삭제 API 제공
 */
import { Router } from "express";
import { isAuthenticated, isUserRegistered } from "../../middleware/auth.mjs";
import { createTask, getTasks, updateTask, deleteTask, completeTask } from "../../models/taskModel.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

// 모든 라우트에 인증 및 등록 확인 미들웨어 적용
router.use(isAuthenticated, isUserRegistered);

/**
 * @route POST /api/task/add
 * @desc 새로운 작업 생성
 * 사용자의 작업 추가 요청 처리
 */
router.post("/add", async (req, res) => {
  try {
    const { contents, priority, from, startDate, dueDate } = req.body;

    // 필수 필드 검증
    if (!contents || !from) {
      logger.warn(`작업 추가 실패: 필수 필드 누락`);
      return res
        .status(400)
        .json({ message: "내용과 출처는 필수 입력 항목입니다" });
    }

    // 작업 생성
    await createTask(req.userId, contents, from, startDate, dueDate, priority);

    logger.verbose(`작업 추가 성공 - 사용자: ${req.userId}`);
    res.status(201).json({ message: "작업이 성공적으로 추가되었습니다" });
  } catch (error) {
    if (error.message === "플래너를 찾을 수 없습니다") {
      logger.warn(`작업 추가 실패: 플래너 없음`);
      return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
    }

    logger.error(`작업 추가 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @route POST /api/task/update
 * @desc 작업 정보 수정
 * 사용자의 작업 정보 업데이트 요청 처리
 */
router.post("/update", async (req, res) => {
  try {
    const { id, contents, priority, from, startDate, dueDate, isCompleted } =
      req.body;

    // ID 필수 검증
    if (!id) {
      logger.warn(`작업 업데이트 실패: ID 누락`);
      return res.status(400).json({ message: "작업 ID는 필수입니다" });
    }

    // 업데이트할 데이터 추출
    const updateData = {};
    if (contents !== undefined) updateData.contents = contents;
    if (priority !== undefined) updateData.priority = priority;
    if (from !== undefined) updateData.from = from;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted;

    // 업데이트할 데이터 검증
    if (Object.keys(updateData).length === 0) {
      logger.warn(`작업 업데이트 실패: 업데이트 데이터 없음`);
      return res
        .status(400)
        .json({ message: "업데이트할 데이터가 필요합니다" });
    }

    // 작업 업데이트
    await updateTask(req.userId, id, updateData);

    logger.verbose(`작업 업데이트 성공 - 사용자: ${req.userId}, 작업ID: ${id}`);
    res.status(200).json({ message: "작업이 성공적으로 업데이트되었습니다" });
  } catch (error) {
    if (error.message === "작업을 찾을 수 없습니다") {
      logger.warn(`작업 업데이트 실패: 작업 없음`);
      return res.status(404).json({ message: "작업을 찾을 수 없습니다" });
    }

    logger.error(`작업 업데이트 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @route POST /api/task/delete
 * @desc 작업 삭제
 * 사용자의 작업 삭제 요청 처리
 */
router.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;

    // ID 필수 검증
    if (!id) {
      logger.warn(`작업 삭제 실패: ID 누락`);
      return res.status(400).json({ message: "작업 ID는 필수입니다" });
    }

    // 작업 삭제
    await deleteTask(req.userId, id);

    logger.verbose(`작업 삭제 성공 - 사용자: ${req.userId}, 작업ID: ${id}`);
    res.status(200).json({ message: "작업이 성공적으로 삭제되었습니다" });
  } catch (error) {
    if (error.message === "작업을 찾을 수 없습니다") {
      logger.warn(`작업 삭제 실패: 작업 없음`);
      return res.status(404).json({ message: "작업을 찾을 수 없습니다" });
    }

    logger.error(`작업 삭제 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @route POST /api/task/complete
 * @desc 작업 완료 표시
 * 사용자의 작업 완료 요청 처리
 */
router.post("/complete", async (req, res) => {
  try {
    const { id } = req.body;

    // ID 필수 검증
    if (!id) {
      logger.warn(`작업 완료 실패: ID 누락`);
      return res.status(400).json({ message: "작업 ID는 필수입니다" });
    }

    // 작업 완료 처리
    await completeTask(req.userId, id);

    logger.verbose(`작업 완료 성공 - 사용자: ${req.userId}, 작업ID: ${id}`);
    res.status(200).json({ message: "작업이 성공적으로 완료되었습니다" });
  } catch (error) {
    if (error.message === "작업을 찾을 수 없습니다") {
      logger.warn(`작업 완료 실패: 작업 없음`);
      return res.status(404).json({ message: "작업을 찾을 수 없습니다" });
    }

    logger.error(`작업 완료 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @route GET /api/task/get
 * @desc 작업 조회
 * 사용자의 전체 작업 또는 특정 플래너의 작업 조회
 */
router.get("/get", async (req, res) => {
  try {
    const { id, isCompleted } = req.query;

    // 특정 플래너의 작업 조회
    const tasks = await getTasks(req.userId, id, isCompleted);

    if (tasks.length === 0) {
      logger.warn(`작업 조회 실패: 작업 없음`);
      return res.status(404).json({ message: "작업을 찾을 수 없습니다" });
    }

    logger.verbose(
      `작업 조회 성공 - 사용자: ${req.userId}, 플래너ID: ${id}, isCompleted: ${isCompleted}`,
    );
    res.status(200).json(tasks);
  } catch (error) {
    if (error.message === "플래너를 찾을 수 없습니다") {
      logger.warn(`작업 조회 실패: 플래너 없음`);
      return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
    }

    logger.error(`작업 조회 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

export default router;
