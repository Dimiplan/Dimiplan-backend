import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Router } from "express";
import logger from "../../utils/logger.mjs";

const router = Router();

/**
 * @name API 엔드포인트 문서 조회
 * @route {GET} /admin/docs
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
router.get("/", async (req, res) => {
  try {
    const docsPath = join(process.cwd(), "docs", "api-docs.json");

    const jsdocData = JSON.parse(readFileSync(docsPath, "utf8"));

    let apiDocs = jsdocData
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
    const seen = new Set();
    apiDocs = apiDocs.filter((doc) => {
      if (seen.has(doc.path + doc.method)) return false;
      seen.add(doc.path + doc.method);
      return true;
    });

    logger.info("API 문서 조회", {
      admin: req.user?.email,
      docCount: apiDocs.length,
    });
    res.json({ success: true, data: apiDocs });
  } catch (error) {
    logger.error("API 문서 조회 실패", { error: error.message });
    res.status(500).json({
      success: false,
      message: "API 문서 조회 중 오류가 발생했습니다",
      error: error.message,
    });
  }
});

/**
 * @name JSDoc 문서 재생성
 * @route {POST} /admin/docs/regenerate
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} message - 성공 메시지
 * @returns {string} timestamp - 재생성 시간
 */
router.post("/regenerate", async (req, res) => {
  try {
    const { exec } = await import("node:child_process");

    await new Promise((resolve, reject) => {
      exec(
        "rd -R docs/ ; jsdoc -c .jsdoc.config.json src/routes/ ; jsdoc -c .jsdoc.config.json src/routes/ -X > docs/api-docs.json",
        (error, stdout, stderr) => {
          if (error) {
            logger.error("JSDoc 재생성 실패", {
              error: error.message,
              stderr,
            });
            reject(error);
          } else {
            logger.info("JSDoc 재생성 성공", { stdout });
            resolve(stdout);
          }
        },
      );
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
