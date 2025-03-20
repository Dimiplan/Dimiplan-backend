import express from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import '@/config/dotenv'
import { createUser, getUser, isRegistered, isUserExists, User } from '@/models/userModel'
import path from 'path'

const router = express.Router()

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!!,
  callbackURL: 'https://dimigo.co.kr:3000/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  console.log('유저다!')
  console.log(profile)
  if (profile._json.hd !== 'dimigo.hs.kr') {
    return done(null, false, { message: 'Not a Dimigo user' })
  }
  const user: User = {
    id: profile.id,
    name: null,
    grade: null,
    class: null,
    email: profile.emails![0].value,
    profile_image: profile.photos![0].value
  }
  createUser(user)
  return done(null, {
    id: user.id
  })
}))

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  hd: 'dimigo.hs.kr',
  prompt: 'select_account'
}))
router.get('/google/callback', passport.authenticate('google', { failureRedirect: path.join(process.env.FRONT_HOST!!, 'login', 'fail') }), async (req, res) => {
  //@ts-ignore
  const uid = req.session?.passport?.user.id
  if (!uid)
    return res.redirect(path.join(process.env.FRONT_HOST!!, 'login', 'fail'))
  const registeded = await isRegistered(uid)
  if (!registeded) {
    res.redirect(`${process.env.FRONT_HOST!!}/signup`)
  } else {
    res.redirect(`${process.env.FRONT_HOST!!}`)
  }
})

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err)
      return res.status(500).send(err)
    return res.redirect(process.env.FRONT_HOST!!)
  })
})

passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((user: unknown, done) => {
  return done(null, user as User)
})

export default router