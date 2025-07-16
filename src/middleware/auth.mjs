import { getUserFromSession } from "../config/sessionConfig.mjs";
import { isRegistered } from "../models/user.mjs";
import { hashUserId } from "../utils/crypto.mjs";
import logger from "../utils/logger.mjs";

export const isAuthenticated = async (req, res, next) => {
  try {
    const sessionIdHeader = req.headers["x-session-id"];
    if (sessionIdHeader) {
      const sessionStore = req.sessionStore;
      const getSessionAsync = (sid) => {
        return new Promise((resolve, reject) => {
          sessionStore.get(sid, (error, session) => {
            if (error) reject(error);
            else resolve(session);
          });
        });
      };

      try {
        const session = await getSessionAsync(sessionIdHeader);

        if (!session) {
          logger.warn(`인증 실패 - 세션을 찾을 수 없음: ${sessionIdHeader}`);
          return res.status(401).json({ message: "인증되지 않음" });
        }

        const uid = getUserFromSession(session);

        if (!uid) {
          logger.warn(
            `인증 실패 - 세션 존재하나 사용자 ID 없음: ${sessionIdHeader}`,
          );
          logger.verbose(`세션 정보:`, session);
          return res.status(401).json({ message: "인증되지 않음" });
        }

        req.userId = uid;
        req.hashedUserId = hashUserId(uid);

        sessionStore.touch(sessionIdHeader, session, (err) => {
          if (err) {
            logger.warn(`세션 갱신 실패: ${err.message}`);
          }
        });

        logger.info(`사용자 인증 성공: ${req.hashedUserId.substring(0, 8)}...`);

        next();
      } catch (err) {
        logger.error("세션 조회 오류:", err);
        return res.status(500).json({ message: "세션 조회 오류" });
      }
    } else {
      const uid = getUserFromSession(req.session);

      if (!uid) {
        logger.warn("인증 실패 - 세션 없음");
        return res.status(401).json({ message: "인증되지 않음" });
      }

      req.userId = uid;
      req.hashedUserId = hashUserId(uid);

      logger.info(`사용자 인증 성공: ${req.hashedUserId.substring(0, 8)}...`);

      next();
    }
  } catch (error) {
    logger.error("인증 처리 중 오류:", error);
    res.status(500).json({ message: "인증 오류" });
  }
};

export const isUserRegistered = async (req, res, next) => {
  try {
    const registered = await isRegistered(req.userId);

    if (!registered) {
      logger.warn(`미등록 사용자: ${req.hashedUserId.substring(0, 8)}...`);
      return res.status(403).json({ message: "미등록 사용자" });
    }

    next();
  } catch (error) {
    logger.error("등록 상태 확인 중 오류:", error);
    res.status(500).json({ message: "내부 서버 오류" });
  }
};

export const rateLimit = (options = {}) => {
  const {
    windowMs = 60 * 1000,
    maxRequests = 100,
    message = "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  } = options;

  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    for (const [requestIP, timestamps] of requests.entries()) {
      requests.set(
        requestIP,
        timestamps.filter((time) => time > windowStart),
      );
      if (requests.get(requestIP).length === 0) {
        requests.delete(requestIP);
      }
    }

    const requestTimestamps = requests.get(ip) || [];

    if (requestTimestamps.length >= maxRequests) {
      logger.warn(`IP에 대한 속도 제한 초과: ${ip}`);
      return res.status(429).json({ message });
    }

    requestTimestamps.push(now);
    requests.set(ip, requestTimestamps);

    next();
  };
};
