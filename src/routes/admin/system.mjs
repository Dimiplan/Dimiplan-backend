/**
 * 관리자 시스템 라우터
 * 시스템 상태 및 AI 사용량 관련 라우트
 */

import os from "node:os";
import { Router } from "express";
import { getUsage } from "../../services/ai.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

/**
 * @name 시스템 상태 조회
 * @route {GET} /admin/system/status
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
router.get("/status", async (req, res) => {
  try {
    const systemInfo = {
      uptime: os.uptime(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      loadavg: os.loadavg()[0]/4,
      platform: process.platform,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    logger.info("시스템 상태 조회", { admin: req.user?.email });
    res.json({ success: true, data: systemInfo });
  } catch (error) {
    logger.error("시스템 상태 조회 실패", { error: error.message });
    res.status(500).json({
      success: false,
      message: "시스템 상태 조회 실패",
    });
  }
});

/**
 * @name AI 사용량 정보 조회
 * @route {GET} /admin/system/ai-usage
 * @returns {boolean} success - 요청 성공 여부
 * @returns {number} data.total_credits - AI 총 크레딧
 * @returns {number} data.total_usage - AI 사용 크레딧
 */
router.get("/ai-usage", async (req, res) => {
  try {
    const usage = await getUsage();
    res.json({ success: true, data: usage.data });
  } catch (error) {
    logger.error("AI 사용량 조회 실패", { error: error.message });
    res.status(500).json({
      success: false,
      message: "AI 사용량 조회 실패",
    });
  }
});

export default router;
