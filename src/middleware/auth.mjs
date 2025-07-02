/**
 * 인증 미들웨어
 * @module auth
 * @description 사용자 인증 및 등록 상태를 검증하는 공통 함수 제공
 */

import { getUserFromSession } from "../config/sessionConfig.mjs";
import { isRegistered } from "../models/user.mjs";
import { hashUserId } from "../utils/crypto.mjs";
import logger from "../utils/logger.mjs";

/**
 * 사용자 인증 여부를 확인하는 미들웨어
 * @async
 * @function isAuthenticated
 * @description 세션 ID 헤더 또는 세션을 통해 사용자 인증을 수행하는 Express 미들웨어
 * @param {object} req - Express 요청 객체
 * @param {object} req.headers - 요청 헤더 객체
 * @param {string} [req.headers.x-session-id] - 선택적 세션 ID 헤더
 * @param {object} req.session - Express 세션 객체
 * @param {object} req.sessionStore - Express 세션 저장소
 * @param {object} res - Express 응답 객체
 * @param {Function} next - Express next 함수
 * @returns {Promise<void>} 인증 성공 시 next() 호출, 실패 시 401/500 응답
 * @example
 * app.use('/api', isAuthenticated);
 */
export const isAuthenticated = async (req, res, next) => {
  try {
    const sessionIdHeader = req.headers["x-session-id"];
    if (sessionIdHeader) {
      // 세션 ID 헤더를 사용한 인증 (프로미스 기반으로 변경)
      const sessionStore = req.sessionStore;

      // sessionStore.get을 프로미스로 변환
      /**
       * @param sid
       * @returns {Promise<object>} 세션 객체
       */
      const getSessionAsync = (sid) => {
        return new Promise((resolve, reject) => {
          sessionStore.get(sid, (error, session) => {
            if (error) reject(error);
            else resolve(session);
          });
        });
      };

      try {
        // 세션 비동기 조회
        const session = await getSessionAsync(sessionIdHeader);

        if (!session) {
          logger.warn(`인증 실패 - 세션을 찾을 수 없음: ${sessionIdHeader}`);
          return res.status(401).json({ message: "인증되지 않음" });
        }

        // 세션에서 사용자 ID 추출
        const uid = getUserFromSession(session);

        if (!uid) {
          logger.warn(
            `인증 실패 - 세션 존재하나 사용자 ID 없음: ${sessionIdHeader}`,
          );
          logger.verbose(`세션 정보:`, session);
          return res.status(401).json({ message: "인증되지 않음" });
        }

        // 요청 객체에 사용자 정보 추가
        req.userId = uid; // 평문 사용자 ID
        req.hashedUserId = hashUserId(uid); // 해시된 사용자 ID

        // 사용자의 세션 유지를 위해 세션 갱신
        sessionStore.touch(sessionIdHeader, session, (err) => {
          if (err) {
            logger.warn(`세션 갱신 실패: ${err.message}`);
          }
        });

        // 인증 성공 로깅
        logger.info(`사용자 인증 성공: ${req.hashedUserId.substring(0, 8)}...`);

        next();
      } catch (err) {
        logger.error("세션 조회 오류:", err);
        return res.status(500).json({ message: "세션 조회 오류" });
      }
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
 * @async
 * @function isUserRegistered
 * @description 인증된 사용자의 등록 상태를 확인하는 Express 미들웨어
 * @param {object} req - Express 요청 객체
 * @param {string} req.userId - 인증된 사용자의 평문 ID (isAuthenticated에서 설정)
 * @param {string} req.hashedUserId - 인증된 사용자의 해시된 ID (isAuthenticated에서 설정)
 * @param {object} res - Express 응답 객체
 * @param {Function} next - Express next 함수
 * @returns {Promise<void>} 등록된 사용자일 경우 next() 호출, 미등록 시 403 응답
 * @requires isAuthenticated 미들웨어가 먼저 실행되어야 함
 * @example
 * app.use('/api/protected', isAuthenticated, isUserRegistered);
 */
export const isUserRegistered = async (req, res, next) => {
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
 * @function rateLimit
 * @description IP 기반 요청 속도 제한을 적용하는 Express 미들웨어 팩토리 함수
 * @param {object} [options={}] - 속도 제한 옵션
 * @param {number} [options.windowMs=60000] - 시간 윈도우 (밀리초, 기본값: 1분)
 * @param {number} [options.maxRequests=100] - 최대 허용 요청 수 (기본값: 100회)
 * @param {string} [options.message="요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."] - 제한 초과 시 메시지
 * @returns {Function} Express 미들웨어 함수
 * @warning 프로덕션 환경에서는 Redis 등 분산 저장소 사용 권장
 * @example
 * // 기본 설정 (1분에 100회)
 * app.use(rateLimit());
 *
 * // 커스텀 설정 (10분에 50회)
 * app.use(rateLimit({
 *   windowMs: 10 * 60 * 1000,
 *   maxRequests: 50,
 *   message: "너무 많은 요청입니다."
 * }));
 */
export const rateLimit = (options = {}) => {
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
