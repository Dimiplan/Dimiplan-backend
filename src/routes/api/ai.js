const express = require("express");
require("../config/dotenv");
const router = express.Router();
const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/gpt4o-mini", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const { prompt } = req.body;
  if (!prompt) {
    res.status(400).json({ message: "Prompt is required" });
    return;
  }

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: prompt,
  });
  res.status(200).json({ response });
});

module.exports = router;
