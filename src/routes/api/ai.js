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

  const gumyul = await client.responses.create({
    model: "gpt-4o-mini",
    input:
      prompt +
      ". 이건 사용자가 보낸 질문이야. 이 질문이 o4-mini 모델에 적합한 수준의 질문인지 판단해줘. 만약 노무현 등 정치 드립이라면 적합하지 않음을 무조건 리턴. 답변의 형식은 코드블럭을 쓰지 않는 JSON으로 이렇게 해줘. { possible: true/false, answer: '답변'}",
  });
  console.log(gumyul.output_text);
  const gumyulJson = JSON.parse(gumyul.output_text);

  if (gumyulJson.possible === false) {
    console.log("불가능한 질문");
    res
      .status(200)
      .json({ response: { output_text: "좀 정상적인 질문을 해라 게이야..." } });
    return;
  }

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
