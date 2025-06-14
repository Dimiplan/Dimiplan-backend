/**
 * 환경 변수 설정 모듈
 * .env 파일에서 환경 변수를 로드하고 기본값을 설정합니다
 *
 * @fileoverview 환경 변수 로드 및 기본값 설정
 */

import { config } from "dotenv";
import { existsSync } from "fs";

/**
 * 환경별 .env 파일 경로를 결정합니다
 *
 * @returns {string[]} 로드할 .env 파일 경로 배열
 */
const getEnvFilePaths = () => {
  const nodeEnv = process.env.NODE_ENV || "test";
  const paths = [];

  // 환경별 파일 우선 로드
  const envFile = `.env.${nodeEnv}`;
  if (existsSync(envFile)) {
    paths.push(envFile);
  }

  // 기본 .env 파일
  if (existsSync(".env")) {
    paths.push(".env");
  }

  return paths;
};

/**
 * 환경 변수를 로드하고 검증합니다
 *
 * @returns {void}
 * @throws {Error} 필수 환경 변수가 없는 경우 오류 발생
 */
const loadEnvironmentVariables = () => {
  const envPaths = getEnvFilePaths();

  // 각 .env 파일 로드
  envPaths.forEach((path) => {
    const result = config({ path });
    if (result.error) {
      console.warn(`환경 변수 파일 로드 실패: ${path}`, result.error.message);
    } else {
      console.log(`환경 변수 파일 로드 성공: ${path}`);
    }
  });

  // 기본값 설정
  setDefaultEnvironmentVariables();

  // 필수 환경 변수 검증
  validateRequiredEnvironmentVariables();
};

/**
 * 기본 환경 변수 값을 설정합니다
 *
 * @returns {void}
 */
const setDefaultEnvironmentVariables = () => {
  // 기본 NODE_ENV 설정
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "test";
  }

  // 기본 포트 설정
  if (!process.env.PORT) {
    process.env.PORT = "3000";
  }

  // 기본 로그 레벨 설정
  if (!process.env.LOG_LEVEL) {
    process.env.LOG_LEVEL =
      process.env.NODE_ENV === "production" ? "info" : "verbose";
  }

  // 기본 세션 설정
  if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET이 설정되지 않았습니다. 임시 값을 사용합니다.");
    process.env.SESSION_SECRET = "temporary-secret-key-change-in-production";
  }
};

/**
 * 필수 환경 변수가 설정되어 있는지 검증합니다
 *
 * @returns {void}
 * @throws {Error} 필수 환경 변수가 없는 경우 오류 발생
 */
const validateRequiredEnvironmentVariables = () => {
  const required = ["PORT", "NODE_ENV"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `필수 환경 변수가 설정되지 않았습니다: ${missing.join(", ")}`,
    );
  }

  // 프로덕션 환경에서 추가 검증
  if (process.env.NODE_ENV === "production") {
    const productionRequired = [
      "CRYPTO_MASTER_KEY",
      "CRYPTO_MASTER_IV",
      "UID_SALT",
      "SESSION_SECRET",
    ];

    const missingProduction = productionRequired.filter(
      (key) => !process.env[key],
    );

    if (missingProduction.length > 0) {
      console.error(
        `프로덕션 환경에서 필수 환경 변수가 설정되지 않았습니다: ${missingProduction.join(", ")}`,
      );
      console.error("보안을 위해 이러한 값들을 설정해주세요.");
    }
  }
};

/**
 * 현재 환경 설정 정보를 반환합니다
 *
 * @returns {object} 환경 설정 정보 객체
 */
export const getEnvironmentInfo = () => ({
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  logLevel: process.env.LOG_LEVEL,
  isDevelopment: process.env.NODE_ENV === "test",
  isProduction: process.env.NODE_ENV === "production",
});

// 환경 변수 로드 실행
try {
  loadEnvironmentVariables();
  console.log("환경 변수 로드 완료:", getEnvironmentInfo());
} catch (error) {
  console.error("환경 변수 로드 실패:", error.message);
  process.exit(1);
}
