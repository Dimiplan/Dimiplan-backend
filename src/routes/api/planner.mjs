/**
 * 플래너 관리 라우터
 * 플래너 생성, 조회, 수정, 삭제 API 제공
 */
import { Router } from "express";
import { isAuthenticated, isUserRegistered } from "../../middleware/auth.mjs";
import { createPlanner, getPlannerById, getPlanners, renamePlanner, deletePlanner } from "../../models/plannerModel.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

// 모든 라우트에 인증 및 등록 확인 미들웨어 적용
router.use(isAuthenticated, isUserRegistered);

/**
 * @route POST /api/planner/add
 * @desc 새로운 플래너 생성
 * 사용자의 플래너 추가 요청 처리
 */
router.post("/add", async (req, res) => {
  try {
    const { name, isDaily, from } = req.body;

    // 필수 필드 검증
    if (name === undefined || from === undefined) {
      logger.warn(`플래너 추가 실패: 필수 필드 누락`);
      return res
        .status(400)
        .json({ message: "이름과 출처는 필수 입력 항목입니다" });
    }

    // 플래너 생성
    await createPlanner(req.userId, name, isDaily, from);

    logger.verbose(`플래너 추가 성공 - 사용자: ${req.userId}`);
    res.status(201).json({ message: "플래너가 성공적으로 추가되었습니다" });
  } catch (error) {
    logger.error(`플래너 추가 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @route POST /api/planner/rename
 * @desc 플래너 이름 변경
 * 사용자의 플래너 이름 수정 요청 처리
 */
router.post("/rename", async (req, res) => {
  try {
    const { id, name } = req.body;

    // 필수 필드 검증
    if (!id || !name) {
      logger.warn(`플래너 이름 변경 실패: 필수 필드 누락`);
      return res.status(400).json({ message: "플래너 ID와 이름은 필수입니다" });
    }

    // 플래너 이름 변경
    await renamePlanner(req.userId, id, name);

    logger.verbose(
      `플래너 이름 변경 성공 - 사용자: ${req.userId}, 플래너ID: ${id}`,
    );
    res
      .status(200)
      .json({ message: "플래너 이름이 성공적으로 변경되었습니다" });
  } catch (error) {
    logger.error(`플래너 이름 변경 중 오류`, error);
    res.status(500).json({ message: "서버 내부 오류" });
  }
});

/**
 * @route POST /api/planner/delete
 * @desc 플래너 삭제
 * 사용자의 플래너와 연관된 모든 플랜 삭제 요청 처리
 */
router.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;

    // 필수 필드 검증
    if (!id) {
      logger.warn(`플래너 삭제 실패: ID 누락`);
      return res.status(400).json({ message: "플래너 ID는 필수입니다" });
    }

    // 플래너 삭제
    await deletePlanner(req.userId, id);

    logger.verbose(`플래너 삭제 성공 - 사용자: ${req.userId}, 플래너ID: ${id}`);
    res.status(200).json({
      message: "플래너와 관련된 모든 플랜이 성공적으로 삭제되었습니다",
    });
  } catch (error) {
    if (error.message === "플래너를 찾을 수 없습니다") {
      logger.warn(`플래너 삭제 실패: 플래너 없음`);
      return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
    }

    logger.error(`플래너 삭제 중 오류`, error);
    res
      .status(500)
      .json({ message: "플래너 삭제 중 오류 발생", error: error.message });
  }
});

/**
 * @route GET /api/planner/getInfo
 * @desc 특정 플래너 정보 조회
 * 사용자의 특정 플래너 상세 정보 요청 처리
 */
router.get("/getInfo", async (req, res) => {
  try {
    const { id } = req.query;

    // 필수 필드 검증
    if (!id) {
      logger.warn(`플래너 정보 조회 실패: ID 누락`);
      return res.status(400).json({ message: "잘못된 요청" });
    }

    // 플래너 정보 조회
    const planner = await getPlannerById(req.userId, id);

    if (!planner) {
      logger.warn(`플래너 정보 조회 실패: 플래너 없음`);
      return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
    }

    logger.verbose(
      `플래너 정보 조회 성공 - 사용자: ${req.userId}, 플래너ID: ${id}`,
    );
    res.status(200).json(planner);
  } catch (error) {
    logger.error(`플래너 정보 조회 중 오류`, error);
    res
      .status(500)
      .json({ message: "플래너 정보 조회 중 오류 발생", error: error.message });
  }
});

/**
 * @route GET /api/planner/getPlanners
 * @desc 모든 플래너 조회
 * 사용자의 모든 플래너 목록 요청 처리
 */
router.get("/getPlanners", async (req, res) => {
  try {
    // 플래너 목록 조회
    const planners = await getPlanners(req.userId);

    if (planners.length === 0) {
      logger.warn(`플래너 목록 조회 실패: 플래너 없음 - ${req.userId}`);
      return res.status(404).json({ message: "플래너를 찾을 수 없습니다" });
    }

    logger.verbose(
      `플래너 목록 조회 성공 - 사용자: ${req.userId}, 플래너 수: ${planners.length}`,
    );
    res.status(200).json(planners);
  } catch (error) {
    logger.error(`플래너 목록 조회 중 오류`, error);
    res
      .status(500)
      .json({ message: "플래너 목록 조회 중 오류 발생", error: error.message });
  }
});

export default router;
