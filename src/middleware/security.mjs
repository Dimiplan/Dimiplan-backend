/**
 * 보안 미들웨어 모듈
 * 사용자 인증, 권한 검증, 요청 제한 등 보안 관련 미들웨어를 제공합니다
 *
 * @fileoverview 보안 미들웨어 및 인증 유틸리티
 */

import rateLimit from "express-rate-limit";
import { getUserFromSession } from "../config/sessionConfig.mjs";
import { isUserExists } from "../models/userModel.mjs";
import logger from "../utils/logger.mjs";

/**
 * IP별 요청 제한 미들웨어 설정
 * DDoS 공격 및 무차별 대입 공격을 방지합니다
 *
 * @param {object} options - 제한 설정 옵션
 * @param {number} [options.windowMs=900000] - 시간 창 (기본: 15분)
 * @param {number} [options.max=100] - 최대 요청 수
 * @param {string} [options.message] - 제한 초과 시 메시지
 * @returns {Function} Rate limiting 미들웨어
 * @example
 * app.use('/api', createRateLimiter({ max: 1000 }));
 */
export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15분
    max = 100, // 기본 요청 제한
    message = "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    standardHeaders = true,
    legacyHeaders = false,
    ...additionalOptions
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders,
    legacyHeaders,
    /**
     * @param req
     * @returns {string} 요청 키
     */
    keyGenerator: (req) => {
      // IP와 User-Agent를 조합하여 더 정확한 식별
      return `${req.ip}:${req.get("User-Agent") || "unknown"}`;
    },
    /**
     *
     * @param req
     * @param res
     */
    handler: (req, res) => {
      logger.warn("Rate limit 초과:", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        url: req.url,
        method: req.method,
      });
      res.status(429).json({ error: message });
    },
    ...additionalOptions,
  });
};

/**
 * 로그인 시도 제한 미들웨어
 * 로그인 엔드포인트에 대한 더 엄격한 제한을 적용합니다
 *
 * @type {Function}
 */
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // 15분에 5번까지만 로그인 시도 허용
  message: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.",
  skipSuccessfulRequests: true, // 성공한 요청은 카운트에서 제외
});

/**
 * API 요청 제한 미들웨어
 * 일반 API 엔드포인트에 대한 표준 제한을 적용합니다
 *
 * @type {Function}
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15분
  max: 1000, // 15분에 1000번까지 API 요청 허용
  message: "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
});

/**
 * 사용자 인증 확인 미들웨어
 * 세션 기반 인증을 확인하고 사용자 정보를 req.user에 설정합니다
 *
 * @middleware
 * @param {object} req - Express 요청 객체
 * @param {object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 * @returns {Promise<void>}
 */
export const requireAuth = async (req, res, next) => {
  try {
    // 세션에서 사용자 ID 추출
    const userId = getUserFromSession(req.session);

    if (!userId) {
      logger.warn("인증되지 않은 접근 시도:", {
        ip: req.ip,
        url: req.url,
        userAgent: req.get("User-Agent"),
      });
      return res.status(401).json({
        error: "인증이 필요합니다",
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    // 사용자 존재 여부 확인
    const userExists = await isUserExists(userId);

    if (!userExists) {
      logger.warn("존재하지 않는 사용자 접근 시도:", {
        userId: userId.substring(0, 8) + "...", // 보안을 위해 일부만 로깅
        ip: req.ip,
        url: req.url,
      });

      // 세션 무효화
      req.session.destroy();

      return res.status(401).json({
        error: "유효하지 않은 사용자입니다",
        code: "INVALID_USER",
      });
    }

    // 요청 객체에 사용자 정보 설정
    req.user = { id: userId };

    logger.verbose("사용자 인증 성공:", {
      userId: userId.substring(0, 8) + "...",
      url: req.url,
    });

    next();
  } catch (error) {
    logger.error("인증 확인 중 오류:", error);
    res.status(500).json({
      error: "인증 확인 중 오류가 발생했습니다",
      code: "AUTHENTICATION_ERROR",
    });
  }
};

/**
 * 선택적 인증 미들웨어
 * 인증이 있으면 사용자 정보를 설정하지만, 없어도 통과시킵니다
 *
 * @middleware
 * @param {object} req - Express 요청 객체
 * @param {object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 * @returns {Promise<void>}
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const userId = getUserFromSession(req.session);

    if (userId) {
      const userExists = await isUserExists(userId);
      if (userExists) {
        req.user = { id: userId };
      }
    }

    next();
  } catch (error) {
    logger.error("선택적 인증 확인 중 오류:", error);
    // 오류가 발생해도 계속 진행
    next();
  }
};

/**
 * 관리자 권한 확인 미들웨어
 * 사용자가 관리자 권한을 가지고 있는지 확인합니다
 * requireAuth 미들웨어와 함께 사용해야 합니다
 *
 * @middleware
 * @param {object} req - Express 요청 객체
 * @param {object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 * @returns {Promise<void>}
 */
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "인증이 필요합니다",
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    // 관리자 권한 확인 로직 (userModel에서 구현 필요)
    // const isAdmin = await checkAdminStatus(req.user.id);

    // 임시로 환경변수를 통한 관리자 확인 (실제로는 DB에서 확인해야 함)
    const adminUsers = process.env.ADMIN_USERS?.split(",") || [];
    const isAdmin = adminUsers.includes(req.user.id);

    if (!isAdmin) {
      logger.warn("관리자 권한 없는 접근 시도:", {
        userId: req.user.id.substring(0, 8) + "...",
        ip: req.ip,
        url: req.url,
      });

      return res.status(403).json({
        error: "관리자 권한이 필요합니다",
        code: "ADMIN_REQUIRED",
      });
    }

    logger.info("관리자 권한 확인됨:", {
      userId: req.user.id.substring(0, 8) + "...",
      url: req.url,
    });

    next();
  } catch (error) {
    logger.error("관리자 권한 확인 중 오류:", error);
    res.status(500).json({
      error: "권한 확인 중 오류가 발생했습니다",
      code: "AUTHORIZATION_ERROR",
    });
  }
};

/**
 * 요청 본문 크기 제한 미들웨어
 * 큰 요청으로 인한 메모리 소모를 방지합니다
 *
 * @param {object} options - 크기 제한 옵션
 * @param {string} [options.limit="1mb"] - 최대 크기
 * @returns {Function} 크기 제한 미들웨어
 */
export const createBodySizeLimiter = (options = {}) => {
  const { limit = "1mb" } = options;

  return (req, res, next) => {
    const contentLength = req.get("Content-Length");

    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      const limitInMB = parseFloat(limit.replace("mb", ""));

      if (sizeInMB > limitInMB) {
        logger.warn("요청 크기 초과:", {
          contentLength,
          limit,
          ip: req.ip,
          url: req.url,
        });

        return res.status(413).json({
          error: "요청 크기가 너무 큽니다",
          code: "PAYLOAD_TOO_LARGE",
        });
      }
    }

    next();
  };
};

/**
 * CORS 보안 강화 미들웨어
 * 추가적인 보안 헤더를 설정합니다
 *
 * @middleware
 * @param {object} req - Express 요청 객체
 * @param {object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 * @returns {void}
 */
export const securityHeaders = (req, res, next) => {
  // 추가 보안 헤더 설정
  res.setHeader(
    "X-Request-ID",
    req.id || Math.random().toString(36).substring(7),
  );
  res.setHeader("X-Response-Time", Date.now());

  // API 응답에 캐시 제어 헤더 추가
  if (req.path.startsWith("/api/")) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
};
