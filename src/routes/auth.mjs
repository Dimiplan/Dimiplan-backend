import { Router } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-custom";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import "../config/dotenv.mjs";
import { createUser, isRegistered } from "../models/user.mjs";
import logger from "../utils/logger.mjs";
import {updateUserInfo} from "../services/user.mjs";

const router = Router();

router.use((req, _res, next) => {
  const headerSid = req.get("x-session-id");
  if (headerSid) {
    req.cookies = req.cookies || {};
    req.cookies["dimiplan.sid"] = headerSid;
  }
  next();
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = {
          id: profile.id,
          name: null,
          grade: null,
          class: null,
          email: profile.emails?.[0]?.value ?? null,
          profile_image: profile.photos?.[0]?.value ?? null,
        };

        await createUser(user);

        return done(null, { id: user.id });
      } catch (error) {
        logger.error("구글 OAuth 콜백 중 오류:", error);
        return done(error);
      }
    },
  ),
);

passport.use(
  "mobile",
  new LocalStrategy(async (req, done) => {
    try {
      const { userId, email, photo, name } = req.body;

      if (!userId) {
        return done(null, false, { message: "사용자 ID 필요" });
      }

      await createUser({
        id: userId,
        name: name,
        grade: null,
        class: null,
        email: email,
        profile_image: photo,
      });

      return done(null, { id: userId });
    } catch (error) {
      logger.error("모바일 인증 전략 오류:", error);
      return done(error);
    }
  }),
);

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
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  }),
);

/**
 * @name 구글 OAuth 콜백 처리
 * @route {GET} /auth/google/callback
 * @returns {Redirect} 등록 상태에 따른 리다이렉트 (/signup 또는 /)
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/google/callback/failure",
  }),
  async (req, res) => {
    try {
      const uid = req.session?.passport?.user?.id;

      if (!uid) {
        return res.redirect(`${process.env.FRONT_HOST}/login/fail`);
      }

      const registered = await isRegistered(uid);

      if (!registered) {
        return res.redirect(`${process.env.FRONT_HOST}/signup`);
      } else {
        return res.redirect(process.env.FRONT_HOST);
      }
    } catch (error) {
      logger.error("구글 콜백 라우트 중 오류:", error);
      logger.info("실패 시 폴백 URL로 리다이렉트:", process.env.FRONT_HOST);
      return res.redirect(`${process.env.FRONT_HOST}/login/fail`);
    }
  },
);

/**
 * @name 구글 OAuth 인증 실패 처리
 * @route {GET} /auth/google/callback/failure
 * @returns {Redirect} 로그인 실패 페이지로 리다이렉트 (/login/fail)
 */
router.get("/google/callback/failure", (req, res) => {
  const failUrl = `${process.env.FRONT_HOST}/login/fail`;
  logger.info("실패 시 URL로 리다이렉트:", failUrl);
  return res.redirect(failUrl);
});

/**
 * @name 사용자 ID로 로그인 (모바일 앱용)
 * @route {POST} /auth/login
 * @param {string} userId - 사용자 ID
 * @param {string} [email] - 사용자 이메일
 * @param {string} [photo] - 프로필 사진 URL
 * @param {string} [name] - 사용자 이름
 * @returns {string} message - 로그인 성공 메시지
 * @returns {string} sessionId - 세션 ID
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
        res.setHeader("x-session-id", req.sessionID);

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
 * @name 사용자 정보 등록
 * @route {POST} /auth/register
 * @bodyparam {string} name - 사용자 이름 (최대 15자)
 * @bodyparam {number} [grade] - 학년 (1-3)
 * @bodyparam {number} [class] - 반 (1-6)
 * @returns {string} message - 업데이트 성공 메시지
 */
router.post("/register", async (req, res) => {
    try {
        if(isRegistered(req.userId)){
            return res.status(400).json({ message: "이미 등록된 사용자입니다" });
        }
        if(!req.body.name){
            return res.status(400).json({ message: "이름은 필수 입력 항목입니다" });
        }
        await updateUserInfo(req.userId, req.body);
        return res.status(204);
    } catch (error) {
        if (error.message === "INVALID_DATA") {
            return res.status(400).json({ message: "반/번호에 오류가 있습니다." });
        }
        logger.error("사용자 정보 업데이트 중 오류:", error);
        res.status(500).json({ message: "서버 내부 오류" });
    }
});

/**
 * @name 사용자 로그아웃
 * @route {GET} /auth/logout
 * @returns {string} message - 로그아웃 완료 메시지
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
