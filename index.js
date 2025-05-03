// Modules
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const helmet = require("helmet");
const { getSessionConfig } = require("./src/config/sessionConfig");
const logger = require("./src/utils/logger");
require("./src/config/dotenv");

// Routes
const authRouter = require("./src/routes/auth");
const apiRouter = require("./src/routes/api");

const app = express();

// 보안 HTTP 헤더 설정
app.use(helmet());

// Trust proxy for secure cookies behind load balancers
app.set("trust proxy", true);

// CORS 설정
const whitelist = [
  "https://dimigo.co.kr",
  "https://m.dimigo.co.kr",
  "https://dimiplan.com",
  "http://localhost:3000",
];

const corsOptions = {
  origin: function (origin, callback) {
    logger.debug("CORS origin:", origin);
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-session-id"],
  exposedHeaders: ["x-session-id"],
  maxAge: 86400, // CORS preflight 캐시 설정 (24시간)
};

app.use(cors(corsOptions));

// 요청 크기 제한 설정
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 세션 설정 - 메모리 기반 저장소 사용
app.use(session(getSessionConfig()));

// 요청 로깅 미들웨어 (헤더 로깅 추가)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  logger.debug("Headers:", req.headers);
  next();
});

// 세션 ID 헤더 처리 미들웨어 (CORS 설정 및 본문 파싱 이후에 배치)
app.use((req, res, next) => {
  // 브라켓 표기법으로 접근 (소문자로 된 헤더 이름 사용)
  const sessionIdHeader = req.headers["x-session-id"];

  if (sessionIdHeader && !req.sessionID) {
    logger.debug(`Found x-session-id header: ${sessionIdHeader}`);

    // 세션 스토어에서 세션 조회
    const sessionStore = req.sessionStore;
    sessionStore.get(sessionIdHeader, (err, session) => {
      if (!err && session) {
        // 세션 복원
        req.sessionID = sessionIdHeader;
        req.session = session;
        logger.debug("Session restored successfully from header");
      } else if (err) {
        logger.warn(`Error retrieving session: ${err.message}`);
      } else {
        logger.warn("Session not found for provided x-session-id");
      }
      next();
    });
  } else {
    next();
  }
});

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());

// 라우터 설정
app.use("/auth", authRouter);
app.use("/api", apiRouter);

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  logger.error("Application error:", err);

  res.status(500).json({ message: "Internal server error" });
});

// 서버 시작
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

// 정상적인 프로세스 종료 처리
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  // 연결된 DB 종료 등의 정리 작업
  process.exit(0);
});

module.exports = app;
