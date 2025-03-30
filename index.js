// Modules
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { ConnectSessionKnexStore } = require('connect-session-knex');
const dbModule = require('./src/config/db'); // dbModule에는 default export와 options가 있을 수 있습니다.
const db = dbModule.default || dbModule; // default export가 있으면 사용, 없으면 모듈 자체 사용
require('./src/config/dotenv'); // Load environment variables

// Routes
const authRouter = require('./src/routes/auth');
const apiRouter = require('./src/routes/api');
const passport = require('passport');

const app = express();

const sessionStore = new ConnectSessionKnexStore({
  knex: db,
  cleanupInterval: 0
});

app.set('trust proxy', true);
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false
  })
);

// !!!!! dotenv 등 .gitignore 필수 !!!!!!
// !!!!! CORS 주의 !!!!!
app.use(cors({
  origin: 'https://dimigo.co.kr', 
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.listen(8080, () => {
  console.log('Server is running on port 8080 (proxy 3000)');
});