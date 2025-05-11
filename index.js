// 필요한 모듈 불러오기
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const helmet = require("helmet");
const { getSessionConfig } = require("./src/config/sessionConfig");
const logger = require("./src/utils/logger");

const https = require("https");
const fs = require("fs");

require("./src/config/dotenv");

const sslOptions = {
  key: fs.readFileSync("./keys/private.pem"),
  cert: fs.readFileSync("./keys/public.pem"),
};

// 라우터 모듈 불러오기
const authRouter = require("./src/routes/auth");
const apiRouter = require("./src/routes/api");

const app = express();

// 테스트 환경에서 요청/응답 로깅을 위한 미들웨어 설정
if (logger.isTestEnvironment) {
  app.use((req, res, next) => {
    // 들어오는 요청 로깅
    logger.logRequest(req);

    // 원본 응답 전송 함수 백업
    const originalSend = res.send;

    // 응답 전송 함수 재정의 (응답 본문 로깅)
    res.send = function (body) {
      logger.logResponse(req, res, body);
      return originalSend.apply(res, arguments);
    };

    next();
  });
}

// 보안 HTTP 헤더 자동 설정
app.use(helmet());

// 로드 밸런서 뒤의 보안 쿠키를 위해 프록시 신뢰 설정
app.set("trust proxy", true);

// CORS(Cross-Origin Resource Sharing) 허용 도메인 목록
const whitelist = [
  "https://dimigo.co.kr",
  "https://m.dimigo.co.kr",
  "https://dimiplan.com",
  "https://m.dimiplan.com",
  "https://dev.dimiplan.com",
  "https://m-dev.dimiplan.com",
  "http://localhost:3000",
];

// CORS 옵션 설정
const corsOptions = {
  origin: function (origin, callback) {
    logger.verbose("CORS 요청 출처:", origin);
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS 정책에 의해 허용되지 않은 요청"));
    }
  },
  credentials: true, // 인증 정보 포함 요청 허용
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // 허용할 HTTP 메서드
  allowedHeaders: ["Content-Type", "Authorization", "x-session-id"], // 허용할 헤더
  exposedHeaders: ["x-session-id"], // 클라이언트에 노출할 헤더
  maxAge: 86400, // CORS 사전 요청(preflight) 캐시 시간 (24시간)
};

// CORS 미들웨어 적용
app.use(cors(corsOptions));

// 요청 본문 크기 제한 설정
app.use(express.json({ limit: "1mb" })); // JSON 페이로드 크기 제한
app.use(express.urlencoded({ extended: true, limit: "1mb" })); // URL 인코딩된 페이로드 크기 제한

// 세션 미들웨어 비동기 초기화
const initializeSession = async (app) => {
  const config = await getSessionConfig();
  app.use(session(config));

  // Passport 초기화 (세션 설정 후)
  app.use(passport.initialize());
  app.use(passport.session());
};

// 모든 요청에 대한 기본 로깅 미들웨어
app.use((req, res, next) => {
  logger.info(`요청 방식: ${req.method}, 경로: ${req.path}, IP: ${req.ip}`);
  next();
});

// 앱 초기화 함수
const initializeApp = async () => {
  // 앱 기본 설정
  // ...

  // 세션 초기화
  await initializeSession(app);

  // 라우트 설정
  app.use("/auth", authRouter); // 인증 관련 라우터
  app.use("/api", apiRouter); // API 관련 라우터

  // 전역 에러 핸들링 미들웨어
  app.use((err, req, res, next) => {
    logger.error("애플리케이션 오류:", err);
    res.status(500).json({ message: "내부 서버 오류" });
  });

  return app;
};

// 앱 시작
let server;
initializeApp()
  .then((app) => {
    const PORT = process.env.PORT;
    server = https.createServer(sslOptions, app);
    server.listen(PORT, () => {
      logger.info(`서버가 ${PORT} 포트에서 실행 중입니다`);
    });
  })
  .catch((err) => {
    logger.error("앱 초기화 오류:", err);
    process.exit(1);
  });

// 프로세스 종료 신호 처리 (정상 종료)
process.on("SIGTERM", () => {
  logger.info("SIGTERM 신호 수신, 안전하게 서버 종료 중");
  // 데이터베이스 연결 종료 등 정리 작업 수행
  server.close(() => {
    logger.info("서버가 안전하게 종료되었습니다");
    process.exit(0);
  });
});

module.exports = app;
