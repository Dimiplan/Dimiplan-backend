/**
 * Authentication routes
 */
const express = require("express");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
require("../config/dotenv");
const { createUser, isRegistered } = require("../models/userModel");
const { storeUserInSession } = require("../config/sessionConfig");
const logger = require("../utils/logger");

const router = express.Router();

// Configure Google OAuth Strategy
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
        // Create user object from profile
        const user = {
          id: profile.id,
          name: null, // User will set this during registration
          grade: null,
          class: null,
          email:
            profile.emails && profile.emails[0]
              ? profile.emails[0].value
              : null,
          profile_image:
            profile.photos && profile.photos[0]
              ? profile.photos[0].value
              : null,
        };

        // Create user in database (will be encrypted by userModel)
        await createUser(user);

        // Return user ID for serialization (only plain user ID)
        return done(null, { id: user.id });
      } catch (error) {
        logger.error("Error in Google OAuth callback:", error);
        return done(error);
      }
    },
  ),
);

// Serialize and deserialize user
// 세션에는 사용자 ID만 평문으로 저장
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

/**
 * @route GET /auth/google
 * @desc Initiate Google OAuth login
 */
router.get(
  "/google",
  (req, res, next) => {
    // Store the origin domain for later redirect
    const originDomain = req.headers.referer || process.env.FRONT_HOST;
    req.session.originDomain = originDomain;

    // Explicitly save the session before continuing
    req.session.save((err) => {
      if (err) {
        logger.error("Error saving session:", err);
        return next(err);
      }
      next();
    });
  },
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  }),
);

/**
 * @route GET /auth/google/callback
 * @desc Google OAuth callback
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/google/callback/failure",
  }),
  async (req, res) => {
    try {
      const uid = req.session?.passport?.user?.id;

      // Get the stored origin domain or fallback to default FRONT_HOST
      const originDomain = req.session.originDomain || process.env.FRONT_HOST;
      logger.info("Redirecting to origin domain:", originDomain);

      if (!uid) {
        return res.redirect(`${originDomain}/login/fail`);
      }

      // Check if user is registered (has set name)
      const registered = await isRegistered(uid);

      // Redirect based on registration status
      if (!registered) {
        return res.redirect(`${originDomain}/signup`);
      } else {
        return res.redirect(`${originDomain}`);
      }
    } catch (error) {
      logger.error("Error in Google callback route:", error);
      const fallbackDomain = req.session.originDomain || process.env.FRONT_HOST;
      logger.info("Redirecting to fallback domain on failure:", fallbackDomain);
      return res.redirect(`${fallbackDomain}/login/fail`);
    }
  },
);

/**
 * @route GET /auth/google/callback/failure
 * @desc Handle Google OAuth failure
 */
router.get("/google/callback/failure", (req, res) => {
  const fallbackDomain = req.session.originDomain || process.env.FRONT_HOST;
  logger.info("Redirecting to fallback domain on failure:", fallbackDomain);
  return res.redirect(`${fallbackDomain}/login/fail`);
});

/**
 * @route POST /auth/login
 * @desc Login with user ID (for mobile)
 */
router.post("/login", async (req, res) => {
  try {
    const { userId, email, photo, name } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Create user if not exists (will be encrypted by userModel)
    await createUser({
      id: userId,
      name: name,
      grade: null,
      class: null,
      email: email,
      profile_image: photo,
    });

    // 평문 userId만 세션에 저장
    storeUserInSession(req.session, userId);

    // 세션 저장 및 세션 ID 추출
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Return success with session ID for mobile apps
    return res.status(200).json({
      message: "Login successful",
      sessionId: req.sessionID,
    });
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route GET /auth/logout
 * @desc Logout user
 */
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error("Logout error:", err);
      return res.status(500).json({ message: "Logout error" });
    }

    res.clearCookie("dimiplan.sid", { path: "/" });
    res.status(200).json({ message: "Logged out" });
  });
});

/**
 * @route GET /auth/session
 * @desc Check session validity
 */
router.get("/session", (req, res) => {
  if (req.session && req.session.passport && req.session.passport.user) {
    return res.status(200).json({ valid: true });
  }
  return res.status(401).json({ valid: false, message: "Invalid session" });
});

module.exports = router;
