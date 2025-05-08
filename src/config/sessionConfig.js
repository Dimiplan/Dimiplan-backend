/**
 * 세션 구성 모듈
 * 안전한 세션 설정 및 관리를 위한 유틸리티 제공
 */
const { generateSecureToken } = require("../utils/cryptoUtils");
const logger = require("../utils/logger");

require("./dotenv"); // 환경 변수 로드

// 세션 비밀 키 (프로덕션에서는 환경 변수로 관리)
const SESSION_SECRET = process.env.SESSION_SECRET || generateSecureToken();

// 세션 최대 유지 시간 (기본값: 24시간, 밀리초 단위)
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE || 86400000, 10);

/**
 * 메모리 기반 세션 저장소 구성
 * 주의: 프로덕션 환경에서는 Redis 등 분산 세션 저장소 고려
 * @returns {Object} 세션 구성 옵션 객체
 */
const getSessionConfig = () => {
  return {
    secret: SESSION_SECRET, // 세션 암호화 비밀 키
    resave: false, // 세션 변경되지 않아도 다시 저장하지 않음
    saveUninitialized: false, // 초기화되지 않은 세션 저장하지 않음
    name: "dimiplan.sid", // 세션 쿠키 이름
    cookie: {
      httpOnly: true, // 클라이언트 측 JavaScript 접근 방지
      secure: true, // HTTPS에서만 쿠키 전송
      sameSite: "none", // 크로스 사이트 요청 허용
      maxAge: SESSION_MAX_AGE, // 쿠키 최대 유지 시간
    },
  };
};

/**
 * 세션에 사용자 ID 저장
 * @param {Object} session - 세션 객체
 * @param {string} userId - 저장할 평문 사용자 ID
 */
const storeUserInSession = (session, userId) => {
  // Passport 형식으로 사용자 ID 저장
  if (!session.passport) {
    session.passport = {};
  }
  session.passport.user = { id: userId };
};

/**
 * 세션에서 사용자 ID 추출
 * @param {Object} session - 세션 객체
 * @returns {string|null} 사용자 ID 또는 null
 */
const getUserFromSession = (session) => {
  logger.debug("세션 정보:", session);
  return session?.passport?.user?.id || null;
};

module.exports = {
  getSessionConfig,
  storeUserInSession,
  getUserFromSession,
};
