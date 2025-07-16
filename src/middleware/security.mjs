import rateLimit from "express-rate-limit";
import { getUserFromSession } from "../config/sessionConfig.mjs";
import { isUserExists } from "../models/user.mjs";
import logger from "../utils/logger.mjs";

export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
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
    keyGenerator: (req) => {
      return `${req.ip}:${req.get("User-Agent") || "unknown"}`;
    },
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

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.",
  skipSuccessfulRequests: true,
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
});

export const requireAuth = async (req, res, next) => {
  try {
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

    const userExists = await isUserExists(userId);

    if (!userExists) {
      logger.warn("존재하지 않는 사용자 접근 시도:", {
        userId: `${userId.substring(0, 8)}...`,
        ip: req.ip,
        url: req.url,
      });

      req.session.destroy();

      return res.status(401).json({
        error: "유효하지 않은 사용자입니다",
        code: "INVALID_USER",
      });
    }

    req.user = { id: userId };

    logger.verbose("사용자 인증 성공:", {
      userId: `${userId.substring(0, 8)}...`,
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
    next();
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "인증이 필요합니다",
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const adminUsers = process.env.ADMIN_USERS?.split(",") || [];
    const isAdmin = adminUsers.includes(req.user.id);

    if (!isAdmin) {
      logger.warn("관리자 권한 없는 접근 시도:", {
        userId: `${req.user.id.substring(0, 8)}...`,
        ip: req.ip,
        url: req.url,
      });

      return res.status(403).json({
        error: "관리자 권한이 필요합니다",
        code: "ADMIN_REQUIRED",
      });
    }

    logger.info("관리자 권한 확인됨:", {
      userId: `${req.user.id.substring(0, 8)}...`,
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

export const securityHeaders = (req, res, next) => {
  res.setHeader(
    "X-Request-ID",
    req.id || Math.random().toString(36).substring(7),
  );
  res.setHeader("X-Response-Time", Date.now());

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
