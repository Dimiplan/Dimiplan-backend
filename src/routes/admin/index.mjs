/**
 * 관리자 라우터 인덱스
 * 관리자 패널 전용 라우트 및 API 엔드포인트 통합 관리
 */

import { Router } from "express";
import { isAdmin } from "../../middleware/adminAuth.mjs";
import databaseRouter from "./database.mjs";
import docsRouter from "./docs.mjs";
import logsRouter from "./logs.mjs";
import statsRouter from "./stats.mjs";
import systemRouter from "./system.mjs";

const router = Router();

// 모든 관리자 라우트에 관리자 권한 검증 적용
router.use(isAdmin);

// 세부 라우터 등록
router.use("/system", systemRouter); // 시스템 상태 및 AI 사용량
router.use("/logs", logsRouter); // 로그 파일 관리
router.use("/database", databaseRouter); // 데이터베이스 관리
router.use("/docs", docsRouter); // API 문서 관리
router.use("/stats", statsRouter); // 통계 정보

export default router;