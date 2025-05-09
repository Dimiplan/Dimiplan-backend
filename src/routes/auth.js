/**
 * 인증 관련 라우터
 * 구글 OAuth를 사용한 로그인 및 사용자 인증 처리
 */
const express = require("express");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
require("../config/dotenv");
const { createUser, isRegistered } = require("../models/userModel");
const { storeUserInSession } = require("../config/sessionConfig");
const logger = require("../utils/logger");

const router = express.Router();

router.use((req, _res, next) => {
  const headerSid = req.get("x-session-id");
  if (headerSid) {
    req.cookies = req.cookies || {};
    req.cookies["dimiplan.sid"] = headerSid;
  }
  next();
});

// 구글 OAuth 전략 설정
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "https://dimigo.co.kr:3000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 프로필 정보로부터 사용자 객체 생성
        const user = {
          id: profile.id,
          name: null, // 회원가입 과정에서 설정됨
          grade: null,
          class: null,
          email: profile.emails?.[0]?.value ?? null,
          profile_image: profile.photos?.[0]?.value ?? null,
        };

        // 데이터베이스에 사용자 생성 (userModel에서 암호화)
        await createUser(user);

        // 직렬화를 위해 사용자 ID만 반환
        return done(null, { id: user.id });
      } catch (error) {
        logger.error("구글 OAuth 콜백 중 오류:", error);
        return done(error);
      }
    },
  ),
);

// 사용자 세션 직렬화 및 역직렬화
// 세션에는 사용자 ID만 평문으로 저장
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

/**
 * @route GET /auth/google
 * @desc 구글 OAuth 로그인 초기화
 * 리다이렉트 도메인 저장 및 구글 인증 페이지로 리다이렉트
 */
router.get(
  "/google",
  (req, res, next) => {
    // 원본 도메인 저장 (나중에 리다이렉트에 사용)
    const originDomain = req.headers.referer || process.env.FRONT_HOST;
    req.session.originDomain = originDomain;

    // 세션 명시적 저장
    req.session.save((err) => {
      if (err) {
        logger.error("세션 저장 중 오류:", err);
        return next(err);
      }
      next();
    });
  },
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account", // 계정 선택 강제
  }),
);

/**
 * @route GET /auth/google/callback
 * @desc 구글 OAuth 콜백 처리
 * 사용자 인증 후 적절한 페이지로 리다이렉트
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/google/callback/failure",
  }),
  async (req, res) => {
    try {
      const uid = req.session?.passport?.user?.id;

      // 저장된 원본 도메인 또는 기본 호스트 사용
      const originDomain = req.session.originDomain || process.env.FRONT_HOST;
      logger.info("원본 도메인으로 리다이렉트:", originDomain);

      if (!uid) {
        return res.redirect(`${originDomain}/login/fail`);
      }

      // 사용자 등록 여부 확인 (이름 설정 기준)
      const registered = await isRegistered(uid);

      // 등록 상태에 따라 리다이렉트
      if (!registered) {
        return res.redirect(`${originDomain}/signup`);
      } else {
        return res.redirect(`${originDomain}`);
      }
    } catch (error) {
      logger.error("구글 콜백 라우트 중 오류:", error);
      const fallbackDomain = req.session.originDomain || process.env.FRONT_HOST;
      logger.info("실패 시 폴백 도메인으로 리다이렉트:", fallbackDomain);
      return res.redirect(`${fallbackDomain}/login/fail`);
    }
  },
);

/**
 * @route GET /auth/google/callback/failure
 * @desc 구글 OAuth 인증 실패 처리
 */
router.get("/google/callback/failure", (req, res) => {
  const fallbackDomain = req.session.originDomain || process.env.FRONT_HOST;
  logger.info("실패 시 폴백 도메인으로 리다이렉트:", fallbackDomain);
  return res.redirect(`${fallbackDomain}/login/fail`);
});

/**
 * @route POST /auth/login
 * @desc 사용자 ID로 로그인 (모바일 앱용)
 * 사용자 생성 및 세션 관리
 */
router.post("/login", async (req, res) => {
  try {
    const { userId, email, photo, name } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "사용자 ID 필요" });
    }

    // 사용자 생성 (userModel에서 암호화)
    await createUser({
      id: userId,
      name: name,
      grade: null,
      class: null,
      email: email,
      profile_image: photo,
    });

    storeUserInSession(req.session, userId);

    // 세션 저장 및 오류 처리
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 세션 ID를 응답 헤더와 본문에 포함
    res.setHeader("x-session-id", req.sessionID);

    // 모바일 앱을 위한 성공 응답
    return res.status(200).json({
      message: "로그인 성공",
      sessionId: req.sessionID,
    });
  } catch (error) {
    logger.error("로그인 오류:", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

/**
 * @route GET /auth/logout
 * @desc 사용자 로그아웃
 * 세션 제거 및 쿠키 초기화
 */
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error("로그아웃 오류:", err);
      return res.status(500).json({ message: "로그아웃 오류" });
    }

    res.clearCookie("dimiplan.sid", { path: "/" });
    res.status(200).json({ message: "로그아웃 완료" });
  });
});

module.exports = router;
