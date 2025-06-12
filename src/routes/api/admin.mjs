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

const router = Router();

// 모든 관리자 라우트에 관리자 권한 검증 적용
router.use(isAdmin);

/**
 * @name 시스템 상태 조회
 * @route GET /api/admin/system-status
 * @returns {object} 시스템 상태 정보
 */
router.get("/system-status", async (req, res) => {
  try {
    const systemInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
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
 * @name 로그 파일 목록 조회
 * @route GET /api/admin/logs
 * @returns {Array} 로그 파일 목록
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
 * @route GET /api/admin/logs/:filename
 * @param {string} filename - 로그 파일명
 * @param {number} [lines=100] - 조회할 라인 수 (query parameter)
 * @returns {object} 로그 파일 내용
 */
router.get("/logs/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const lines = parseInt(req.query.lines) || 100;

    if (!filename.endsWith(".log")) {
      return res
        .status(400)
        .json({ success: false, message: "유효하지 않은 로그 파일" });
    }

    const filePath = join(process.cwd(), "logs", filename);
    const content = readFileSync(filePath, "utf8");
    const allLines = content.split("\n");
    const recentLines = lines > 0 ? allLines.slice(-lines) : allLines;

    logger.info("로그 파일 내용 조회", {
      admin: req.user?.email,
      filename,
      lines: recentLines.length,
    });

    res.json({
      success: true,
      data: {
        filename,
        totalLines: allLines.length,
        displayedLines: recentLines.length,
        content: recentLines.join("\n"),
      },
    });
  } catch (error) {
    logger.error("로그 파일 내용 조회 실패", { error: error.message });
    res.status(500).json({ success: false, message: "로그 파일 읽기 실패" });
  }
});

/**
 * @name 데이터베이스 테이블 목록 조회
 * 데이터베이스의 모든 테이블 목록과 기본 정보 제공
 *
 * @route GET /api/admin/database/tables
 * @returns {Array} 테이블 목록
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
 * @route GET /api/admin/database/tables/:tableName
 * @param {string} tableName - 테이블명
 * @param {number} [page=1] - 페이지 번호
 * @param {number} [limit=50] - 페이지당 항목 수
 * @returns {object} 테이블 데이터와 페이지네이션 정보
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
 * @route GET /api/admin/stats/users
 * @returns {object} 사용자 통계 정보
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
 * @route GET /api/admin/docs
 * @returns {Array} API 엔드포인트 문서 목록
 */
router.get("/docs", async (req, res) => {
  try {
    // JSDoc JSON 파일 경로
    const docsPath = join(process.cwd(), "docs", "api-docs.json");

    // JSDoc JSON 파일이 없으면 생성
    if (!readFileSync(docsPath, "utf8").length) {
      const { exec } = await import("child_process");
      await new Promise((resolve, reject) => {
        exec("npm run docs:json", (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });
    }

    // JSDoc 데이터 읽기
    const jsdocData = JSON.parse(readFileSync(docsPath, "utf8"));

    // API 라우터에서 함수들 추출
    const apiDocs = [];
    const apiDir = join(process.cwd(), "src", "routes", "api");
    const apiFiles = readdirSync(apiDir).filter((file) =>
      file.endsWith(".mjs"),
    );

    // JSDoc 데이터에서 라우터 함수들만 필터링
    for (const item of jsdocData) {
      if (item.kind === "function" && item.description) {
        // 파일에서 라우터 정의 찾기
        for (const file of apiFiles) {
          const filePath = join(apiDir, file);
          const content = readFileSync(filePath, "utf8");

          // Express 라우터 패턴 찾기
          const routerMatches = content.match(
            new RegExp(
              `router\\.(get|post|put|delete|patch)\\s*\\(\\s*["']([^"']+)["']`,
              "g",
            ),
          );

          if (routerMatches) {
            for (const match of routerMatches) {
              const routeMatch = match.match(
                /router\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/,
              );
              if (routeMatch) {
                const method = routeMatch[1].toUpperCase();
                const path = `/api/admin${routeMatch[2]}`;

                // JSDoc 정보와 매칭
                if (
                  content.includes(item.name) ||
                  (item.longname && content.includes(item.longname))
                ) {
                  apiDocs.push({
                    file: file.replace(".mjs", ""),
                    method,
                    path,
                    brief:
                      item.description.replace(/<[^>]*>/g, "").trim() ||
                      item.name,
                    details: item.comment
                      ? item.comment
                          .split("\n")
                          .find((line) => line.includes("@details"))
                          ?.replace(/.*@details\s*/, "") || ""
                      : "",
                    returns: item.returns
                      ? item.returns[0]?.description
                          ?.replace(/<[^>]*>/g, "")
                          .trim() || ""
                      : "",
                    params: item.params || [],
                    examples: item.examples || [],
                  });
                  break;
                }
              }
            }
          }
        }
      }
    }

    // 기존 doxygen 방식도 병행 지원 (이전 호환성)
    for (const file of apiFiles) {
      const filePath = join(apiDir, file);
      const content = readFileSync(filePath, "utf8");

      const doxygenBlocks = content.match(/\/\*\*[\s\S]*?\*\//g) || [];

      for (const block of doxygenBlocks) {
        const briefMatch = block.match(/@brief\s+(.*)/);
        const detailsMatch = block.match(/@details\s+(.*)/);
        const routeMatch = block.match(/@route\s+(\w+)\s+(\/[^\s]*)/);
        const returnsMatch = block.match(/@returns\s+(.*)/);

        if (briefMatch && routeMatch) {
          // 중복 체크
          const exists = apiDocs.some(
            (doc) =>
              doc.method === routeMatch[1].toUpperCase() &&
              doc.path === routeMatch[2],
          );

          if (!exists) {
            apiDocs.push({
              file: file.replace(".mjs", ""),
              method: routeMatch[1].toUpperCase(),
              path: routeMatch[2],
              brief: briefMatch[1],
              details: detailsMatch ? detailsMatch[1] : "",
              returns: returnsMatch ? returnsMatch[1] : "",
            });
          }
        }
      }
    }

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
 * @route POST /api/admin/docs/regenerate
 * @returns {object} 재생성 결과
 */
router.post("/docs/regenerate", async (req, res) => {
  try {
    const { exec } = await import("child_process");

    await new Promise((resolve, reject) => {
      exec("npm run docs:json", (error, stdout, stderr) => {
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
