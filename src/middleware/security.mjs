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