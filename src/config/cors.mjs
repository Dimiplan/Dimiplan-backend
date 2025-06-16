/**
 * CORS(Cross-Origin Resource Sharing) 설정 모듈
 * 도메인별 접근 제어 및 보안 정책을 관리합니다
 *
 * @fileoverview CORS 정책 및 설정 관리
 */

import cors from "cors";
import "./dotenv.mjs";

/**
 * 허용된 도메인 목록
 * 프로덕션 환경에서 접근을 허용할 도메인들을 정의합니다
 *
 * @type {string[]}
 */
const ALLOWED_DOMAINS = [
  ".dimiplan.com",
  ".dimiplan-mobile.pages.dev",
  ".dimiplan-backend-admin-panel.pages.dev",
];

/**
 * Origin 검증 함수
 * 요청 출처가 허용된 도메인인지 확인합니다
 *
 * @param {string|undefined} origin - 요청 출처 URL
 * @param {Function} callback - CORS 검증 결과 콜백 함수
 * @returns {void}
 * @example
 * // CORS 미들웨어에서 자동으로 호출됨
 * validateOrigin(origin, callback);
 */
const validateOrigin = (origin, callback) => {
  // null origin 처리 (파일:// 프로토콜 등)
  if (origin === "null" || !origin) {
    return callback(null, true);
  }

  // 허용된 도메인 확인
  const isAllowed = ALLOWED_DOMAINS.some((domain) => origin.endsWith(domain));

  if (isAllowed) {
    callback(null, true);
  } else {
    callback(
      new Error(`CORS 정책에 의해 허용되지 않은 요청: ${origin}`),
      false,
    );
  }
};

/**
 * CORS 설정 옵션을 생성합니다
 * 환경에 따라 적절한 CORS 정책을 적용합니다
 *
 * @returns {object} CORS 설정 객체
 * @example
 * const corsConfig = getCorsOptions();
 * app.use(cors(corsConfig));
 */
export const getCorsOptions = () => ({
  origin: validateOrigin,
  credentials: true, // 인증 정보 포함 요청 허용
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // 허용할 HTTP 메서드
  allowedHeaders: ["Content-Type", "Authorization", "x-session-id"], // 허용할 헤더
  exposedHeaders: ["x-session-id"], // 클라이언트에 노출할 헤더
  maxAge: 86400, // CORS 사전 요청(preflight) 캐시 시간 (24시간)
  optionsSuccessStatus: 200, // IE11 지원을 위한 옵션
});

/**
 * 설정된 CORS 미들웨어를 반환합니다
 *
 * @returns {Function} 설정된 CORS 미들웨어 함수
 * @example
 * const corsMiddleware = getCorsConfig();
 * app.use(corsMiddleware);
 */
export const getCorsConfig = () => {
  const options = getCorsOptions();
  return cors(options);
};

/**
 * 특정 라우터에 대한 CORS 설정을 생성합니다
 *
 * @param {object} customOptions - 커스텀 CORS 옵션
 * @param {string[]} [customOptions.methods] - 허용할 HTTP 메서드
 * @param {string[]} [customOptions.allowedHeaders] - 허용할 헤더
 * @returns {Function} 커스텀 CORS 미들웨어 함수
 * @example
 * const apiCors = getCustomCorsConfig({
 *   methods: ["GET", "POST"],
 *   allowedHeaders: ["Content-Type"]
 * });
 */
export const getCustomCorsConfig = (customOptions = {}) => {
  const defaultOptions = getCorsOptions();
  const mergedOptions = { ...defaultOptions, ...customOptions };
  return cors(mergedOptions);
};
