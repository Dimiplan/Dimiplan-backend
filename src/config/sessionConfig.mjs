/**
 * 세션 구성 모듈
 * @module sessionConfig
 * @description 안전한 세션 설정 및 Redis 기반 세션 관리를 위한 유틸리티 제공
 */
import { generateSecureToken } from "../utils/cryptoUtils.mjs";
import logger from "../utils/logger.mjs";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";
import { promisify } from "util";

import "./dotenv.mjs"; // 환경 변수 로드

/**
 * 세션 비밀 키 (프로덕션에서는 환경 변수로 관리)
 * @type {string}
 * @constant
 */
const SESSION_SECRET = process.env.SESSION_SECRET || generateSecureToken();

/**
 * Redis 클라이언트 인스턴스
 * @type {Object|null}
 */
let redisClient;

/**
 * Redis 기반 세션 저장소 인스턴스
 * @type {Object|null}
 */
let redisStore;

/**
 * Redis 클라이언트 초기화
 * @async
 * @function initRedisClient
 * @description Redis 서버에 연결하고 클라이언트 인스턴스를 초기화합니다
 * @returns {Promise<Object>} Redis 클라이언트 객체
 * @throws {Error} Redis 연결 실패 시 에러 발생
 * @example
 * const client = await initRedisClient();
 */
export const initRedisClient = async () => {
  if (redisClient) return redisClient;

  // Redis 연결 설정
  redisClient = createClient(6379, "127.0.0.1");

  redisClient.on("error", (err) => {
    logger.error("Redis 클라이언트 오류:", err);
  });

  redisClient.on("connect", () => {
    logger.info("Redis 서버에 연결되었습니다");
  });

  redisClient.getAsync = promisify(redisClient.get).bind(redisClient);
  redisClient.setAsync = promisify(redisClient.set).bind(redisClient);
  redisClient.delAsync = promisify(redisClient.del).bind(redisClient);

  // Redis 연결
  await redisClient
    .connect()
    .catch((err) => {
      logger.error("Redis 연결 실패:", err);
      throw err;
    })
    .then(() => {
      logger.info("Redis 서버에 연결되었습니다");
      // Redis 세션 저장소 초기화
      redisStore = new RedisStore({
        client: redisClient,
        ttl: 86400, // Redis에 저장되는 세션의 TTL (초 단위)
        prefix: "dimiplan:sess:",
      });
    });

  return redisClient;
};

/**
 * Redis 기반 세션 저장소 구성
 * @async
 * @function getSessionConfig
 * @description 세션 구성 옵션을 생성하고 반환합니다
 * @returns {Promise<Object>} 세션 구성 옵션 객체
 * @returns {string} returns.secret - 세션 암호화 비밀 키
 * @returns {boolean} returns.resave - 세션 재저장 여부
 * @returns {boolean} returns.saveUninitialized - 초기화되지 않은 세션 저장 여부
 * @returns {string} returns.name - 세션 쿠키 이름
 * @returns {Object} returns.store - Redis 세션 저장소
 * @returns {Object} returns.cookie - 쿠키 설정
 * @example
 * const config = await getSessionConfig();
 */
export const getSessionConfig = async () => {
  // Redis 클라이언트 초기화
  await initRedisClient().catch((err) => {
    logger.error("Redis 초기화 실패, 메모리 세션으로 폴백합니다:", err);
    // Redis 사용 불가 시 기본 메모리 세션 사용
    return null;
  });

  return {
    secret: SESSION_SECRET, // 세션 암호화 비밀 키
    resave: false, // 세션 변경되지 않아도 다시 저장하지 않음
    saveUninitialized: false, // 초기화되지 않은 세션 저장하지 않음
    name: "dimiplan.sid", // 세션 쿠키 이름
    store: redisStore, // Redis 세션 저장소
    cookie: {
      httpOnly: true, // 클라이언트 측 JavaScript 접근 방지
      secure: true, // HTTPS에서만 쿠키 전송
      sameSite: "none", // 크로스 사이트 요청 허용
      maxAge: 86400000, // 쿠키 최대 유지 시간
    },
  };
};

/**
 * 세션에 사용자 ID 저장
 * @function storeUserInSession
 * @description Passport 형식으로 세션에 사용자 ID를 저장합니다
 * @param {Object} session - 세션 객체
 * @param {string} userId - 저장할 평문 사용자 ID
 * @example
 * storeUserInSession(req.session, 'user123');
 */
export const storeUserInSession = (session, userId) => {
  // Passport 형식으로 사용자 ID 저장
  if (!session.passport) {
    session.passport = {};
  }
  session.passport.user = { id: userId };
};

/**
 * 세션에서 사용자 ID 추출
 * @function getUserFromSession
 * @description 세션에서 저장된 사용자 ID를 추출합니다
 * @param {Object} session - 세션 객체
 * @returns {string|null} 사용자 ID 또는 null
 * @example
 * const userId = getUserFromSession(req.session);
 */
export const getUserFromSession = (session) => {
  logger.verbose("세션 정보:", session);
  return session?.passport?.user?.id || null;
};

/**
 * 애플리케이션 종료 시 Redis 연결 해제
 * @async
 * @function closeRedisConnection
 * @description Redis 클라이언트 연결을 안전하게 종료합니다
 * @returns {Promise<void>}
 * @example
 * await closeRedisConnection();
 */
export const closeRedisConnection = async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info("Redis 연결이 종료되었습니다");
  }
};
