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

// POST 로그인 요청 처리
router.post('/login', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: '사용자 ID가 필요합니다.' });
    }
    
    // 사용자 존재 여부 확인
    const exists = await isRegistered(userId);
    if (!exists) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }
    
    // 세션에 사용자 정보 저장
    req.login({ id: userId }, (err) => {
      if (err) {
        return res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다.' });
      }
      
      return res.status(200).json({ message: '로그인 성공' });
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
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

router.get('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('connect.sid', { path: '/' });
    res.status(200).json({ message: 'Logged out' });
  });
});

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = router;