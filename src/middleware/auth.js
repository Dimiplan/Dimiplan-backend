/**
 * 인증 미들웨어
 * 사용자 인증 및 등록 상태를 검증하는 공통 함수 제공
 */
const { isRegistered } = require("../models/userModel");
const logger = require("../utils/logger");
const { hashUserId } = require("../utils/cryptoUtils");
const { getUserFromSession } = require("../config/sessionConfig");

/**
 * 사용자 인증 여부를 확인하는 미들웨어
 * 세션 ID 헤더 또는 세션을 통해 사용자 인증
 */
const isAuthenticated = (req, res, next) => {
  try {
    const sessionIdHeader = req.headers["x-session-id"];
    if (sessionIdHeader) {
      const sessionStore = req.sessionStore;
      // 세션 ID 헤더를 사용한 인증
      return sessionStore.get(
        sessionIdHeader,
        (session) => {
          // 세션에서 사용자 ID 추출
          const uid = getUserFromSession(session);

          if (!uid) {
            logger.warn(
              `인증 실패 - 세션 존재하나 사용자 ID 없음: ${sessionIdHeader}`,
            );
            return res.status(401).json({ message: "인증되지 않음" });
          }

          // 요청 객체에 사용자 정보 추가
          req.userId = uid; // 평문 사용자 ID
          req.hashedUserId = hashUserId(uid); // 해시된 사용자 ID

          // 인증 성공 로깅
          logger.info(
            `사용자 인증 성공: ${req.hashedUserId.substring(0, 8)}...`,
          );

          next();
        },
        (err) => {
          logger.error("세션 조회 오류:", err);
          return res.status(500).json({ message: "세션 조회 오류" });
        },
      );
    } else {
      // 기본 세션을 사용한 인증
      const uid = getUserFromSession(req.session);

      if (!uid) {
        logger.warn("인증 실패 - 세션 없음");
        return res.status(401).json({ message: "인증되지 않음" });
      }

      // 요청 객체에 사용자 정보 추가
      req.userId = uid; // 평문 사용자 ID
      req.hashedUserId = hashUserId(uid); // 해시된 사용자 ID

      // 인증 성공 로깅
      logger.info(`사용자 인증 성공: ${req.hashedUserId.substring(0, 8)}...`);

      next();
    }
  } catch (error) {
    logger.error("인증 처리 중 오류:", error);
    res.status(500).json({ message: "인증 오류" });
  }
};

/**
 * 사용자 등록 여부를 확인하는 미들웨어
 * isAuthenticated 미들웨어 이후에 사용해야 함
 */
const isUserRegistered = async (req, res, next) => {
  try {
    // 사용자 등록 상태 확인
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

/**
 * 무차별 대입 공격(Brute Force Attack)을 방지하는 속도 제한 미들웨어
 * @param {Object} options - 속도 제한 옵션
 * @param {number} options.windowMs - 시간 윈도우 (기본값: 1분)
 * @param {number} options.maxRequests - 최대 허용 요청 수 (기본값: 100회)
 * @param {string} options.message - 제한 초과 시 메시지 (기본값: 나중에 다시 시도)
 */
const rateLimit = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1분
    maxRequests = 100, // 1분당 100회 요청
    message = "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  } = options;

  // 속도 제한을 위한 단순 메모리 저장소
  // 프로덕션 환경에서는 Redis 등 분산 저장소 사용 권장
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // 오래된 요청 정보 정리
    for (const [requestIP, timestamps] of requests.entries()) {
      requests.set(
        requestIP,
        timestamps.filter((time) => time > windowStart),
      );
      if (requests.get(requestIP).length === 0) {
        requests.delete(requestIP);
      }
    }

    // IP별 요청 타임스탬프 가져오기 또는 초기화
    const requestTimestamps = requests.get(ip) || [];

    // 속도 제한 초과 여부 확인
    if (requestTimestamps.length >= maxRequests) {
      logger.warn(`IP에 대한 속도 제한 초과: ${ip}`);
      return res.status(429).json({ message });
    }

    // 현재 타임스탬프 추가 및 저장
    requestTimestamps.push(now);
    requests.set(ip, requestTimestamps);

    next();
  };
};

module.exports = {
  isAuthenticated,
  isUserRegistered,
  rateLimit,
};
