const express = require("express");
const db = require("../../config/db");
const router = express.Router();
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.get("/getRoomList", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  try {
    const roomData = await db("chat_rooms").where("uid", uid).select("*");
    res.status(200).json({ roomData });
  } catch (error) {
    console.error("Error fetching room list:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/addRoom", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ message: "Room name is required" });
    return;
  }

  const roomId = db("userid").select("roomId").where("uid", uid);

  try {
    await db("chat_rooms").insert({
      owner: uid,
      id: roomId,
      name,
    });
    db("userid")
      .update("roomId")
      .where("uid", uid)
      .update("roomId", roomId + 1);
    res.status(200).json({ message: "Room added successfully" });
  } catch (error) {
    console.error("Error adding room:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/getChatInRoom", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const { from } = req.query;
  if (!from) {
    res.status(400).json({ message: "Room ID is required" });
    return;
  }

  try {
    const chatData = await db("chat").where("roomId", from).select("*");
    res.status(200).json({ chatData });
  } catch (error) {
    console.error("Error fetching chat data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/GPT4o_m", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const { prompt, room } = req.body;
  if (!prompt) {
    res.status(400).json({ message: "Prompt is required" });
    return;
  }
  if (!room) {
    res.status(400).json({ message: "Room ID is required" });
    return;
  }

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: prompt,
  });

  const chatId = db("userid").select("chatId").where("uid", uid);
  res.status(200).json({ response });
  db("chat").insert({
    from: room,
    owner: uid,
    id: chatId,
    message: prompt,
    sender: "user",
  });
  db("chat").insert({
    from: room,
    owner: uid,
    id: chatId + 1,
    message: prompt,
    sender: "ai",
  });
  db("userid")
    .update("chatId")
    .where("uid", uid)
    .update("chatId", chatId + 2);
});

router.post("/GPT4o", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const { prompt, room } = req.body;
  if (!prompt) {
    res.status(400).json({ message: "Prompt is required" });
    return;
  }
  if (!room) {
    res.status(400).json({ message: "Room ID is required" });
    return;
  }

  const response = await client.responses.create({
    model: "gpt-4o",
    input: prompt,
  });

  const chatId = db("userid").select("chatId").where("uid", uid);
  res.status(200).json({ response });
  db("chat").insert({
    from: room,
    owner: uid,
    id: chatId,
    message: prompt,
    sender: "user",
  });
  db("chat").insert({
    from: room,
    owner: uid,
    id: chatId + 1,
    message: prompt,
    sender: "ai",
  });
  db("userid")
    .update("chatId")
    .where("uid", uid)
    .update("chatId", chatId + 2);
});

router.post("/GPT41", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const { prompt, room } = req.body;
  if (!prompt) {
    res.status(400).json({ message: "Prompt is required" });
    return;
  }
  if (!room) {
    res.status(400).json({ message: "Room ID is required" });
    return;
  }

  const response = await client.responses.create({
    model: "gpt-4.1",
    input: prompt,
  });

  const chatId = db("userid").select("chatId").where("uid", uid);
  res.status(200).json({ response });
  db("chat").insert({
    from: room,
    owner: uid,
    id: chatId,
    message: prompt,
    sender: "user",
  });
  db("chat").insert({
    from: room,
    owner: uid,
    id: chatId + 1,
    message: prompt,
    sender: "ai",
  });
  db("userid")
    .update("chatId")
    .where("uid", uid)
    .update("chatId", chatId + 2);
});

router.post("/o4_m", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const { prompt, room } = req.body;
  console.log(prompt, room);
  if (!prompt) {
    res.status(400).json({ message: "Prompt is required" });
    return;
  }
  if (!room) {
    res.status(400).json({ message: "Room ID is required" });
    return;
  }
  console.log("APPROVED!");

  const response = await client.responses.create({
    model: "o4-mini",
    input: prompt,
  });
  console.log(response);

  const chatId = db("userid").select("chatId").where("uid", uid);
  res.status(200).json({ response });
  db("chat").insert({
    from: room,
    owner: uid,
    id: chatId,
    message: prompt,
    sender: "user",
  });
  db("chat").insert({
    from: room,
    owner: uid,
    id: chatId + 1,
    message: prompt,
    sender: "ai",
  });
  db("userid")
    .update("chatId")
    .where("uid", uid)
    .update("chatId", chatId + 2);
});

module.exports = router;
