/**
 * 관리자 인증 라우터
 * 관리자 전용 인증 처리 (계정 생성 기능 제외)
 */
import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import "../../config/dotenv.mjs";
import { isRegistered } from "../../models/user.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

// 관리자 전용 구글 OAuth 전략 설정
passport.use(
  "google-admin",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_ADMIN_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const userId = profile.id;
        
        // 사용자가 이미 등록되어 있는지 확인
        const registered = await isRegistered(userId);
        if (!registered) {
          return done(null, false, { message: "등록되지 않은 사용자입니다" });
        }

        // 직렬화를 위해 사용자 ID만 반환
        return done(null, { id: userId });
      } catch (error) {
        logger.error("관리자 구글 OAuth 콜백 중 오류:", error);
        return done(error);
      }
    },
  ),
);

/**
 * @name 관리자 구글 OAuth 로그인 초기화
 * @route {GET} /admin/auth/google
 * @returns {Redirect} 구글 OAuth 인증 페이지로 리다이렉트
 */
router.get(
  "/google",
  passport.authenticate("google-admin", {
    scope: ["profile", "email"],
    prompt: "select_account",
  }),
);

/**
 * @name 관리자 구글 OAuth 콜백 처리
 * @route {GET} /admin/auth/google/callback
 * @returns {Redirect} 관리자 권한 확인 후 적절한 페이지로 리다이렉트
 */
router.get(
  "/google/callback",
  passport.authenticate("google-admin", {
    failureRedirect: "/admin/auth/google/callback/failure",
  }),
  async (req, res) => {
    try {
      const uid = req.session?.passport?.user?.id;
      const adminHost = process.env.ADMIN_HOST || process.env.FRONT_HOST;

      if (!uid) {
        return res.redirect(`${adminHost}/admin/login/fail`);
      }

      // 관리자 권한 확인 - 미들웨어 대신 직접 확인
      const { checkAdminStatus } = await import("../../middleware/adminAuth.mjs");
      const adminStatus = await checkAdminStatus(uid);

      if (!adminStatus) {
        logger.warn("관리자 권한 없는 사용자의 관리자 로그인 시도", {
          userId: uid,
          ip: req.ip,
        });
        return res.redirect(`${adminHost}/admin/login/unauthorized`);
      }

      // 관리자 권한 확인됨 - 관리자 패널로 리다이렉트
      logger.info("관리자 로그인 성공", {
        adminId: uid,
        ip: req.ip,
      });
      
      return res.redirect(`${adminHost}/admin`);
    } catch (error) {
      logger.error("관리자 구글 콜백 라우트 중 오류:", error);
      const adminHost = process.env.ADMIN_HOST || process.env.FRONT_HOST;
      return res.redirect(`${adminHost}/admin/login/fail`);
    }
  },
);

/**
 * @name 관리자 구글 OAuth 인증 실패 처리
 * @route {GET} /admin/auth/google/callback/failure
 * @returns {Redirect} 관리자 로그인 실패 페이지로 리다이렉트
 */
router.get("/google/callback/failure", (req, res) => {
  const adminHost = process.env.ADMIN_HOST || process.env.FRONT_HOST;
  logger.info("관리자 로그인 실패로 리다이렉트:", `${adminHost}/admin/login/fail`);
  return res.redirect(`${adminHost}/admin/login/fail`);
});

export default router;