/**
 * 인증 관련 라우터
 * 구글 OAuth를 사용한 로그인 및 사용자 인증 처리
 */
import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-custom"; // 추가: 커스텀 전략
import "../config/dotenv";
import { createUser, isRegistered } from "../models/userModel";
import { storeUserInSession } from "../config/sessionConfig";
import logger from "../utils/logger.mjs";

const router = Router();

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
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
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

// 모바일 로그인을 위한 커스텀 전략 설정
passport.use(
  "mobile",
  new LocalStrategy(async function (req, done) {
    try {
      const { userId, email, photo, name } = req.body;

      if (!userId) {
        return done(null, false, { message: "사용자 ID 필요" });
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

      // 인증 성공: 사용자 정보 반환
      return done(null, { id: userId });
    } catch (error) {
      logger.error("모바일 인증 전략 오류:", error);
      return done(error);
    }
  }),
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
 * @name 구글 OAuth 로그인 초기화
 * @route {GET} /auth/google
 * @returns {Redirect} 구글 OAuth 인증 페이지로 리다이렉트
 * @example
 * // GET /auth/google
 * // 브라우저가 구글 로그인 페이지로 리다이렉트됨
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
 * @name 구글 OAuth 콜백 처리
 * @route {GET} /auth/google/callback
 * @returns {Redirect} 등록 상태에 따른 리다이렉트 (/signup 또는 /)
 * @example
 * // 미등록 사용자: /signup으로 리다이렉트
 * // 등록된 사용자: /로 리다이렉트
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
 * @name 구글 OAuth 인증 실패 처리
 * @route {GET} /auth/google/callback/failure
 * @returns {Redirect} 로그인 실패 페이지로 리다이렉트 (/login/fail)
 */
router.get("/google/callback/failure", (req, res) => {
  const fallbackDomain = req.session.originDomain || process.env.FRONT_HOST;
  logger.info("실패 시 폴백 도메인으로 리다이렉트:", fallbackDomain);
  return res.redirect(`${fallbackDomain}/login/fail`);
});

/**
 * @name 사용자 ID로 로그인 (모바일 앱용)
 * @route {POST} /auth/login
 * @param {string} userId - 사용자 ID (필수)
 * @param {string} [email] - 사용자 이메일
 * @param {string} [photo] - 프로필 사진 URL
 * @param {string} [name] - 사용자 이름
 * @returns {object} 로그인 성공 메시지와 세션 ID
 * @example
 * // POST /auth/login
 * // Body: { "userId": "123456", "email": "user@example.com" }
 * // Response: { "message": "로그인 성공", "sessionId": "sess_abc123" }
 */
router.post("/login", (req, res, next) => {
  passport.authenticate("mobile", (err, user, info) => {
    if (err) {
      logger.error("모바일 로그인 오류:", err);
      return res.status(500).json({ message: "서버 오류" });
    }

    if (!user) {
      return res.status(400).json({ message: info.message || "인증 실패" });
    }

    req.login(user, async (err) => {
      if (err) {
        logger.error("세션 저장 오류:", err);
        return res.status(500).json({ message: "세션 오류" });
      }

      try {
        // 세션 저장 및 오류 처리
        req.session.save((err) => {
          if (err) {
            logger.error("세션 저장 중 오류:", err);
            return next(err);
          }
          next();
        });
        req.session.regenerate((err) => {
          if (err) {
            logger.error("세션 재생성 오류:", err);
            return res.status(500).json({ message: "세션 오류" });
          }
        });
        // 세션 ID를 응답 헤더와 본문에 포함
        res.setHeader("x-session-id", req.sessionID);

        // 모바일 앱을 위한 성공 응답
        return res.status(200).json({
          message: "로그인 성공",
          sessionId: req.sessionID,
        });
      } catch (error) {
        logger.error("세션 저장 오류:", error);
        return res.status(500).json({ message: "세션 오류" });
      }
    });
  })(req, res, next);
});

/**
 * @name 사용자 로그아웃
 * @route {GET} /auth/logout
 * @returns {object} 로그아웃 완료 메시지
 * @example
 * // GET /auth/logout
 * // Response: { "message": "로그아웃 완료" }
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

export default router;
