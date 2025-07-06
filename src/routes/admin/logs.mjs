/**
 * 관리자 로그 라우터
 * 로그 파일 관리 관련 라우트
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Router } from "express";
import logger from "../../utils/logger.mjs";

const router = Router();

/**
 * @name 로그 파일 목록 조회
 * @route {GET} /admin/logs
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} data[].name - 로그 파일명
 * @returns {number} data[].size - 파일 크기 (바이트)
 * @returns {string} data[].modified - 수정 날짜
 * @returns {string} data[].path - 파일 경로
 */
router.get("/", async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: "로그 파일 목록 조회 실패",
    });
  }
});

/**
 * @name 특정 로그 파일 내용 조회
 * @route {GET} /admin/logs/:filename
 * @param {string} filename - 로그 파일명
 * @param {number} [lines=100] - 조회할 라인 수
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} data.filename - 로그 파일명
 * @returns {number} data.lines - 총 라인 수
 * @returns {string} data.content - 로그 파일 내용
 */
router.get("/:filename", async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: "로그 파일 읽기 실패",
    });
  }
});

/**
 * @name 로그 파일 삭제
 * @route {DELETE} /admin/logs/:filename
 * @routeparam {string} filename - 삭제할 로그 파일명
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} message - 성공 메시지
 */
router.delete("/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename.endsWith(".log")) {
      return res.status(400).json({
        success: false,
        message: "유효하지 않은 로그 파일",
      });
    }

    const { unlinkSync } = await import("node:fs");
    const filePath = join(process.cwd(), "logs", filename);

    unlinkSync(filePath);

    logger.info("로그 파일 삭제", {
      admin: req.user?.email,
      filename,
    });

    res.json({
      success: true,
      message: "로그 파일이 삭제되었습니다",
    });
  } catch (error) {
    logger.error("로그 파일 삭제 실패", { error: error.message });
    res.status(500).json({
      success: false,
      message: "로그 파일 삭제 실패",
    });
  }
});

/**
 * @name 모든 로그 파일 비우기
 * @route {POST} /admin/logs/clear
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} message - 성공 메시지
 * @returns {number} data.clearedFiles - 비워진 파일 수
 */
router.post("/clear", async (req, res) => {
  try {
    const { writeFileSync } = await import("node:fs");
    const logsDir = join(process.cwd(), "logs");
    const files = readdirSync(logsDir);

    const logFiles = files.filter((file) => file.endsWith(".log"));
    let clearedFiles = 0;

    logFiles.forEach((file) => {
      const filePath = join(logsDir, file);
      writeFileSync(filePath, "");
      clearedFiles++;
    });

    logger.info("모든 로그 파일 비우기", {
      admin: req.user?.email,
      clearedFiles,
    });

    res.json({
      success: true,
      message: "모든 로그 파일이 비워졌습니다",
      data: { clearedFiles },
    });
  } catch (error) {
    logger.error("로그 파일 비우기 실패", { error: error.message });
    res.status(500).json({
      success: false,
      message: "로그 파일 비우기 실패",
    });
  }
});

export default router;
