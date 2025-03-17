// Modules
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import { ConnectSessionKnexStore } from 'connect-session-knex'
import db, { options as dbOptions } from './config/db'
import '@/config/dotenv'
// Routes
import authRouter from './routes/auth'

const app = express()

const sessionStore = new ConnectSessionKnexStore({
  knex: db,
  cleanupInterval: 0
})

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
// app.use(cors({
//   origin: '-프론트 URL-',
//   credentials: true
// }))
app.use(express.urlencoded({ extended: true }))

app.use('/auth', authRouter)

app.get('/', (req, res) => {
  // @ts-ignore
  res.send(`니이름: ${req.session?.passport?.user.id}`)
})

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})