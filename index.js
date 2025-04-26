// Modules
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { ConnectSessionKnexStore } = require("connect-session-knex");
const dbModule = require("./src/config/db"); // dbModule에는 default export와 options가 있을 수 있습니다.
const db = dbModule.default || dbModule; // default export가 있으면 사용, 없으면 모듈 자체 사용
require("./src/config/dotenv"); // Load environment variables

// Routes
const authRouter = require("./src/routes/auth");
const apiRouter = require("./src/routes/api");
const passport = require("passport");

const app = express();

const sessionStore = new ConnectSessionKnexStore({
  knex: db,
  cleanupInterval: 0,
});

app.set("trust proxy", true);
// Add this middleware to your Express app before your routes
app.use((req, res, next) => {
  // First check session authentication (existing cookie method)
  if (req.session && req.session.passport && req.session.passport.user) {
    return next();
  }

  // Check for session ID in custom header
  const sessionId = req.headers["x-session-id"];
  if (sessionId) {
    // Use your session store to retrieve the session with this ID
    sessionStore.get(sessionId, (err, session) => {
      if (err) {
        console.error("Error retrieving session:", err);
        return next();
      }

      if (session && session.passport && session.passport.user) {
        // Reconstruct the session
        req.session = session;
        return next();
      } else {
        return next();
      }
    });
  } else {
    // No authentication found
    next();
  }
});
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      sameSite: "none", // Allows cross-site cookies
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

const whitelist = [
  "https://dimigo.co.kr",
  "https://m.dimigo.co.kr",
  "http://localhost:3000",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps)
    if (!origin) return callback(null, true);

    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Session-ID", "Cookie"],
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());

app.use("/auth", authRouter);
app.use("/api", apiRouter);

app.listen(8080, () => {
  console.log("Server is running on port 8080 (proxy 3000)");
});
