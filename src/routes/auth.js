/**
 * Authentication routes
 */
const express = require("express");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const path = require("path");
require("../config/dotenv");
const { createUser, isRegistered } = require("../models/userModel");

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

        // Create user in database
        await createUser(user);

        // Return user ID for serialization
        return done(null, { id: user.id });
      } catch (error) {
        console.error("Error in Google OAuth callback:", error);
        return done(error);
      }
    },
  ),
);

// Serialize and deserialize user
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
    failureRedirect: path.join(process.env.FRONT_HOST, "login", "fail"),
  }),
  async (req, res) => {
    try {
      const uid = req.session?.passport?.user?.id;

      if (!uid) {
        return res.redirect(path.join(process.env.FRONT_HOST, "login", "fail"));
      }

      // Check if user is registered (has set name)
      const registered = await isRegistered(uid);

      // Redirect based on registration status
      if (!registered) {
        return res.redirect(`${process.env.FRONT_HOST}/signup`);
      } else {
        return res.redirect(`${process.env.FRONT_HOST}`);
      }
    } catch (error) {
      console.error("Error in Google callback route:", error);
      return res.redirect(path.join(process.env.FRONT_HOST, "login", "fail"));
    }
  },
);

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

    // Create user if not exists
    await createUser({
      id: userId,
      name: name,
      grade: null,
      class: null,
      email: email,
      profile_image: photo,
    });

    // Login the user
    req.login({ id: userId }, (err) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Login processing error" });
      }

      // Return success with session ID
      return res.status(200).json({
        message: "Login successful",
        sessionId: req.sessionID,
      });
    });
  } catch (error) {
    console.error("Login error:", error);
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
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Logout error" });
    }

    res.clearCookie("connect.sid", { path: "/" });
    res.status(200).json({ message: "Logged out" });
  });
});

module.exports = router;
