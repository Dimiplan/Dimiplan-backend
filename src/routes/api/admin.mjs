/**
 * 관리자 API 라우터
 * 관리자 패널 전용 API 엔드포인트 제공
 * 로그 조회, DB 조회, 시스템 정보 등 관리 기능
 */
import { Router } from "express";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { db } from "../../config/db.mjs";
import logger from "../../utils/logger.mjs";
import { isAdmin } from "../../middleware/adminAuth.mjs";
import os, { loadavg } from "os";
import { getUsage } from "../../services/ai.mjs";

const router = Router();

// 모든 관리자 라우트에 관리자 권한 검증 적용
router.use(isAdmin);

/**
 * @name 시스템 상태 조회
 * @route {GET} /api/admin/system-status
 * @returns {boolean} success - 요청 성공 여부
 * @returns {number} data.uptime - 서버 실행 시간 (초)
 * @returns {number} data.totalmem - 전체 메모리 (바이트)
 * @returns {number} data.freemem - 사용 가능한 메모리 (바이트)
 * @returns {number} data.loadavg - 시스템 로드 평균
 * @returns {string} data.platform - 운영체제 플랫폼
 * @returns {string} data.nodeVersion - Node.js 버전
 * @returns {string} data.environment - 실행 환경
 * @returns {string} data.timestamp - 조회 시간
 */
router.get("/system-status", async (req, res) => {
  try {
    const systemInfo = {
      uptime: process.uptime(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      loadavg: os.loadavg()[0],
      platform: process.platform,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    logger.info("시스템 상태 조회", { admin: req.user?.email });
    res.json({ success: true, data: systemInfo });
  } catch (error) {
    logger.error("시스템 상태 조회 실패", { error: error.message });
    res.status(500).json({ success: false, message: "시스템 상태 조회 실패" });
  }
});

/**
 * @name AI 사용량 정보 조회
 * @route {GET} /api/admin/ai-usage
 * @returns {boolean} success - 요청 성공 여부
 * @returns {number} data.total_credits - AI 총 크레딧
 * @returns {number} data.total_usage - AI 사용 크레딧
 */
router.get("/ai-usage", async (req, res) => {
  try {
    const usage = await getUsage();
    res.json({ success: true, data: usage["data"] });
  } catch (error) {
    logger.error("AI 사용량 조회 실패", { error: error.message });
    res.status(500).json({ success: false, message: "AI 사용량 조회 실패" });
  }
});

/**
 * @name 로그 파일 목록 조회
 * @route {GET} /api/admin/logs
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} data[].name - 로그 파일명
 * @returns {number} data[].size - 파일 크기 (바이트)
 * @returns {string} data[].modified - 수정 날짜
 * @returns {string} data[].path - 파일 경로
 */
router.get("/logs", async (req, res) => {
  try {
    const logsDir = join(process.cwd(), "logs");
    const files = readdirSync(logsDir);

    const logFiles = files
      .filter((file) => file.endsWith(".log"))
      .map((file) => {
        const filePath = join(logsDir, file);
        const stats = statSync(filePath);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          path: filePath,
        };
      })
      .sort((a, b) => b.modified - a.modified);

    logger.info("로그 파일 목록 조회", {
      admin: req.user?.email,
      count: logFiles.length,
    });
    res.json({ success: true, data: logFiles });
  } catch (error) {
    logger.error("로그 파일 목록 조회 실패", { error: error.message });
    res
      .status(500)
      .json({ success: false, message: "로그 파일 목록 조회 실패" });
  }
});

/**
 * @name 특정 로그 파일 내용 조회
 * @route {GET} /api/admin/logs/:filename
 * @param {string} filename - 로그 파일명
 * @param {number} [lines=100] - 조회할 라인 수
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} data.filename - 로그 파일명
 * @returns {number} data.lines - 총 라인 수
 * @returns {string} data.content - 로그 파일 내용
 */
router.get("/logs/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename.endsWith(".log")) {
      return res
        .status(400)
        .json({ success: false, message: "유효하지 않은 로그 파일" });
    }

    const filePath = join(process.cwd(), "logs", filename);
    const content = readFileSync(filePath, "utf8");
    const allLines = content.split("\n").reverse(); // 최신 로그가 위에 오도록 역순 정렬

    logger.info("로그 파일 내용 조회", {
      admin: req.user?.email,
      filename,
      lines: allLines.length,
    });

    res.json({
      success: true,
      data: {
        filename,
        lines: allLines.length,
        content: allLines.join("\n"),
      },
    });
  } catch (error) {
    logger.error("로그 파일 내용 조회 실패", { error: error.message });
    res.status(500).json({ success: false, message: "로그 파일 읽기 실패" });
  }
});

/**
 * @name 데이터베이스 테이블 목록 조회
 * @route {GET} /api/admin/database/tables
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} data[].name - 테이블명
 * @returns {number} data[].rowCount - 테이블 행 수
 */
router.get("/database/tables", async (req, res) => {
  try {
    const tables = await db.raw("SHOW TABLES");
    const tableList = tables[0].map((row) => Object.values(row)[0]);

    const tablesInfo = await Promise.all(
      tableList.map(async (tableName) => {
        const [count] = await db(tableName).count("* as count");
        return {
          name: tableName,
          rowCount: count.count,
        };
      }),
    );

    logger.info("데이터베이스 테이블 목록 조회", {
      admin: req.user?.email,
      tableCount: tablesInfo.length,
    });

    res.json({ success: true, data: tablesInfo });
  } catch (error) {
    logger.error("데이터베이스 테이블 목록 조회 실패", {
      error: error.message,
    });
    res.status(500).json({ success: false, message: "데이터베이스 조회 실패" });
  }
});

/**
 * @name 특정 테이블 데이터 조회
 * @route {GET} /api/admin/database/tables/:tableName
 * @routeparam {string} tableName - 테이블명
 * @queryparam {number} [page=1] - 페이지 번호
 * @queryparam {number} [limit=50] - 페이지당 항목 수
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} data.tableName - 테이블명
 * @returns {string} data.columns[].name - 컬럼명
 * @returns {string} data.columns[].type - 컬럼 타입
 * @returns {boolean} data.columns[].nullable - null 허용 여부
 * @returns {string} data.columns[].key - 키 정보
 * @returns {string} data.columns[].default - 기본값
 * @returns {Array} data.rows - 테이블 데이터
 * @returns {number} data.pagination.page - 현재 페이지
 * @returns {number} data.pagination.limit - 페이지당 항목 수
 * @returns {number} data.pagination.totalCount - 전체 항목 수
 * @returns {number} data.pagination.totalPages - 전체 페이지 수
 */
router.get("/database/tables/:tableName", async (req, res) => {
  try {
    const { tableName } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // 테이블 존재 확인
    const tableExists = await db.schema.hasTable(tableName);
    if (!tableExists) {
      return res
        .status(404)
        .json({ success: false, message: "테이블을 찾을 수 없습니다" });
    }

    // 전체 레코드 수 가져오기
    const [{ count: totalCount }] = await db(tableName).count("* as count");

    // 데이터 가져오기
    const data = await db(tableName).select("*").limit(limit).offset(offset);

    // 컬럼 정보 가져오기
    const columns = await db.raw(`DESCRIBE ${tableName}`);
    const columnInfo = columns[0].map((col) => ({
      name: col.Field,
      type: col.Type,
      nullable: col.Null === "YES",
      key: col.Key,
      default: col.Default,
    }));

    logger.info("테이블 데이터 조회", {
      admin: req.user?.email,
      tableName,
      page,
      limit,
      totalCount,
    });

    res.json({
      success: true,
      data: {
        tableName,
        columns: columnInfo,
        rows: data,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    logger.error("테이블 데이터 조회 실패", { error: error.message });
    res
      .status(500)
      .json({ success: false, message: "테이블 데이터 조회 실패" });
  }
});

/**
 * @name 사용자 통계 정보 조회
 * @route {GET} /api/admin/stats/users
 * @returns {boolean} success - 요청 성공 여부
 * @returns {number} data.totalUsers - 전체 사용자 수
 * @returns {number} data.activeUsers - 최근 30일 활성 사용자 수
 * @returns {string} data.recentUsers[].id - 사용자 ID
 * @returns {string} data.recentUsers[].email - 사용자 이메일
 * @returns {string} data.recentUsers[].created_at - 가입 날짜
 */
router.get("/stats/users", async (req, res) => {
  try {
    const [totalUsers] = await db("users").count("* as count");
    const [activeUsers] = await db("users")
      .where("created_at", ">", db.raw("DATE_SUB(NOW(), INTERVAL 30 DAY)"))
      .count("* as count");

    const recentUsers = await db("users")
      .select("id", "email", "created_at")
      .orderBy("created_at", "desc")
      .limit(10);

    const stats = {
      totalUsers: totalUsers.count,
      activeUsers: activeUsers.count,
      recentUsers,
    };

    logger.info("사용자 통계 조회", { admin: req.user?.email });
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error("사용자 통계 조회 실패", { error: error.message });
    res.status(500).json({ success: false, message: "사용자 통계 조회 실패" });
  }
});

/**
 * @name API 엔드포인트 문서 조회
 * @route {GET} /api/admin/docs
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} data[].file - 파일명
 * @returns {string} data[].method - HTTP 메소드
 * @returns {string} data[].path - API 경로
 * @returns {string} data[].name - API 이름
 * @returns {Array} data[].params - 파라미터 목록
 * @returns {Array} data[].routeParams - 라우트 파라미터 목록
 * @returns {string} data[].returns.type - 반환 타입
 * @returns {string} data[].returns.description - 반환 설명
 */
router.get("/docs", async (req, res) => {
  try {
    const docsPath = join(process.cwd(), "docs", "api-docs.json");

    // api-docs.json 파일 읽기
    const jsdocData = JSON.parse(readFileSync(docsPath, "utf8"));

    // 라우터 정보만 필터링
    const apiDocs = jsdocData
      .filter((item) => item.route && item.name)
      .map((item) => ({
        file: item.meta?.filename?.replace(".mjs", "") || "unknown",
        method: item.route.type,
        path: item.route.name,
        name: item.name,
        params: item.bodyparams || item.queryparams || [],
        routeParams: item.routeparams || [],
        returns: item.returns.map((ret) => ({
          type: ret.type,
          description: ret.description?.replace(/<[^>]*>/g, "").trim() || "",
        })),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));

    logger.info("API 문서 조회", {
      admin: req.user?.email,
      docCount: apiDocs.length,
    });
    res.json({ success: true, data: apiDocs });
  } catch (error) {
    logger.error("API 문서 조회 실패", { error: error.message });
    res.status(500).json({ success: false, message: "API 문서 생성 실패" });
  }
});

/**
 * @name JSDoc 문서 재생성
 * @route {POST} /api/admin/docs/regenerate
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} message - 성공 메시지
 * @returns {string} timestamp - 재생성 시간
 */
router.post("/docs/regenerate", async (req, res) => {
  try {
    const { exec } = await import("child_process");

    await new Promise((resolve, reject) => {
      exec("bun run docs && bun run docs:json", (error, stdout, stderr) => {
        if (error) {
          logger.error("JSDoc 재생성 실패", { error: error.message, stderr });
          reject(error);
        } else {
          logger.info("JSDoc 재생성 성공", { stdout });
          resolve(stdout);
        }
      });
    });

    logger.info("JSDoc 문서 재생성 완료", { admin: req.user?.email });
    res.json({
      success: true,
      message: "JSDoc 문서가 재생성되었습니다",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("JSDoc 문서 재생성 실패", { error: error.message });
    res.status(500).json({
      success: false,
      message: "JSDoc 문서 재생성 실패",
      error: error.message,
    });
  }
});

export default router;
