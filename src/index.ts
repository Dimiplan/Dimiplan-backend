// Modules
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import { ConnectSessionKnexStore } from 'connect-session-knex'
import db, { options as dbOptions } from './config/db'
import '@/config/dotenv'
// Routes
import authRouter from './routes/auth'
import apiRouter from './routes/api'
import passport from 'passport'

const app = express()

const sessionStore = new ConnectSessionKnexStore({
  knex: db,
  cleanupInterval: 0
})

app.set('trust proxy', true)
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false
  })
)
// !!!!! dotenv 등 .gitignore 필수 !!!!!!
// !!!!! CORS 주의 !!!!!
app.use(cors({
  origin: 'https://dimigo.co.kr', // Allow CORS for this domain
  credentials: true
}))
app.use(express.urlencoded({ extended: true }))
app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRouter)
app.use('/api', apiRouter)

app.listen(8080, () => {
  console.log('Server is running on port 8080 (proxy 3000)')
})