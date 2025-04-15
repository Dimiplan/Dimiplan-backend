const { getUser, isRegistered, updateUser } = require("../../models/userModel");
const express = require("express");
const userRouter = require("./user");
const planRouter = require("./plan");

const router = express.Router();

router.use("/user", userRouter);
router.use("/plan", planRouter);

router.use(async (req, res, next) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
  } else {
    if (await isRegistered(uid)) {
      next();
    } else {
      res.status(403).json({ message: "Not registered" });
    }
  }
});

module.exports = router;
