/**
 * 인증 관련 라우터
 * 구글 OAuth를 사용한 로그인 및 사용자 인증 처리
 */
import { Router } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-custom"; // 추가: 커스텀 전략
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import "../config/dotenv";
import { createUser, isRegistered } from "../models/user";
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
    new LocalStrategy(async (req, done) => {
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
        // returnUrl이 있으면 세션에 저장
        if (req.query.returnUrl) {
            req.session.returnUrl = req.query.returnUrl;
        }

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
            const returnUrl = req.session?.returnUrl;

            // 저장된 returnUrl이 있으면 해당 URL로, 없으면 기본 호스트 사용
            const redirectDomain = returnUrl || process.env.FRONT_HOST;
            logger.info("리다이렉트 URL:", redirectDomain);

            if (!uid) {
                const failUrl = returnUrl
                    ? `${returnUrl}?login=fail`
                    : `${process.env.FRONT_HOST}/login/fail`;
                return res.redirect(failUrl);
            }

            // 사용자 등록 여부 확인 (이름 설정 기준)
            const registered = await isRegistered(uid);

            // returnUrl 세션에서 제거
            delete req.session.returnUrl;

            // 등록 상태에 따라 리다이렉트
            if (!registered) {
                const signupUrl = returnUrl
                    ? `${returnUrl}?signup=required`
                    : `${process.env.FRONT_HOST}/signup`;
                return res.redirect(signupUrl);
            } else {
                // 등록된 사용자는 returnUrl로 또는 기본 페이지로 리다이렉트
                return res.redirect(redirectDomain);
            }
        } catch (error) {
            logger.error("구글 콜백 라우트 중 오류:", error);
            const fallbackUrl =
                req.session?.returnUrl || process.env.FRONT_HOST;
            logger.info("실패 시 폴백 URL로 리다이렉트:", fallbackUrl);
            const failUrl = req.session?.returnUrl
                ? `${req.session.returnUrl}?login=fail`
                : `${process.env.FRONT_HOST}/login/fail`;
            return res.redirect(failUrl);
        }
    },
);

/**
 * @name 구글 OAuth 인증 실패 처리
 * @route {GET} /auth/google/callback/failure
 * @returns {Redirect} 로그인 실패 페이지로 리다이렉트 (/login/fail)
 */
router.get("/google/callback/failure", (req, res) => {
    const returnUrl = req.session?.returnUrl;
    const failUrl = returnUrl
        ? `${returnUrl}?login=fail`
        : `${process.env.FRONT_HOST}/login/fail`;
    logger.info("실패 시 URL로 리다이렉트:", failUrl);

    // returnUrl 세션에서 제거
    delete req.session.returnUrl;

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
            return res
                .status(400)
                .json({ message: info.message || "인증 실패" });
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
 * @returns {string} message - 로그아웃 완료 메시지
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
