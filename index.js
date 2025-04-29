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
const webhookRouter = require("./src/routes/webhook");
const passport = require("passport");

const app = express();

const sessionStore = new ConnectSessionKnexStore({
  knex: db,
  cleanupInterval: 0,
});

app.set("trust proxy", true);

// Webhook route - Add this before other middleware to ensure it works with raw body
app.use("/update", webhookRouter);

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
      sameSite: "none",
      secure: true,
    },
  }),
);

const whitelist = [
  "https://dimigo.co.kr",
  "https://m.dimigo.co.kr",
  "http://localhost:3000",
  "https://dimiplan.com",
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log("CORS origin:", origin);
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
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
