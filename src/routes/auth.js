const express = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
require('../config/dotenv');
const { createUser, getUser, isRegistered, isUserExists } = require('../models/userModel');
const path = require('path');

const router = express.Router();

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'https://dimigo.co.kr:3000/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  console.log('User joined');
  console.log(profile);
  if (profile._json.hd !== 'dimigo.hs.kr') {
    return done(null, false, { message: 'Not a Dimigo user' });
  }
  const user = {
    id: profile.id,
    name: null,
    grade: null,
    class: null,
    email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
    profile_image: profile.photos && profile.photos[0] ? profile.photos[0].value : null
  };
  createUser(user);
  return done(null, { id: user.id });
}));

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  hd: 'dimigo.hs.kr',
  prompt: 'select_account'
}));

router.get('/google/callback', passport.authenticate('google', { 
  failureRedirect: path.join(process.env.FRONT_HOST, 'login', 'fail')
}), async (req, res) => {
  const uid = req.session && req.session.passport && req.session.passport.user && req.session.passport.user.id;
  if (!uid) {
    return res.redirect(path.join(process.env.FRONT_HOST, 'login', 'fail'));
  }
  const registeded = await isRegistered(uid);
  if (!registeded) {
    res.redirect(`${process.env.FRONT_HOST}/signup`);
  } else {
    res.redirect(`${process.env.FRONT_HOST}`);
  }
});

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err)
      return res.status(500).send(err);
    return res.redirect(process.env.FRONT_HOST);
  });
});

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = router;