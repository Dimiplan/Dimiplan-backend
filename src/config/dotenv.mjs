import { config } from "dotenv";

const loadEnvironmentVariables = () => {
  config();
  setDefaultEnvironmentVariables();
  validateRequiredEnvironmentVariables();
};

const setDefaultEnvironmentVariables = () => {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "test";
  }

  if (!process.env.PORT) {
    process.env.PORT = "3000";
  }

  if (!process.env.LOG_LEVEL) {
    process.env.LOG_LEVEL =
      process.env.NODE_ENV === "production" ? "info" : "verbose";
  }

  if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET이 설정되지 않았습니다. 임시 값을 사용합니다.");
    process.env.SESSION_SECRET = "temporary-secret-key-change-in-production";
  }
};

const validateRequiredEnvironmentVariables = () => {
  const required = ["PORT", "NODE_ENV"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `필수 환경 변수가 설정되지 않았습니다: ${missing.join(", ")}`,
    );
  }

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

export const getEnvironmentInfo = () => ({
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  logLevel: process.env.LOG_LEVEL,
  isDevelopment: process.env.NODE_ENV === "test",
  isProduction: process.env.NODE_ENV === "production",
});

try {
  loadEnvironmentVariables();
  console.log("환경 변수 로드 완료:", getEnvironmentInfo());
} catch (error) {
  console.error("환경 변수 로드 실패:", error.message);
  process.exit(1);
}
