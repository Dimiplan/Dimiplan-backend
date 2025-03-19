import express from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import '@/config/dotenv'
import { createUser, User } from '@/models/userModel'

const router = express.Router()

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!!,
  callbackURL: '/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  console.log('유저다!')
  console.log(profile)
  const user: User = {
    id: profile.id,
    nickname: profile.displayName,
    email: profile.emails![0].value,
    profile_image: profile.photos![0].value
  }
  createUser(user)
  done(null, {
    id: user.id
  })
}))

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  hd: 'dimigo.hs.kr',
  prompt: 'select_account'
}))
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  res.redirect('/')
})

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user: unknown, done) => {
  return done(null, user as User)
});

export default router