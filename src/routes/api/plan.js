const { getUser, isRegistered, updateUser } = require("../../models/userModel");
const express = require("express");
const db = require("../../config/db");
const router = express.Router();

const folderNameBlacklist = ["Root", "root", "new", "all"];

router.post("/addPlan", async (req, res) => {
  const { contents, priority, from } = req.body;
  console.log(contents, priority, from);

  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const startDate = req.body.startDate;
  const dueDate = req.body.dueDate; //date를 받음 (null일 수도 있음)

  let formattedStartDate = null;
  if (startDate) {
    formattedStartDate = new Date(startDate).toISOString().slice(0, 10); // "YYYY-MM-DD"
  }
  let formattedDueDate = null;
  if (dueDate) {
    formattedDueDate = new Date(dueDate).toISOString().slice(0, 10); // "YYYY-MM-DD"
  }

  const planner = await db("planner") //from 값을 받아서 그에 맞는 planner 테이블을 조회
    .where({ owner: uid, id: from })
    .select("*")
    .first();

  if (!planner) {
    res.status(404).json({ message: "Planner not found" });
    return;
  }

  const samePlan = await db("plan")
    .where({ owner: uid, from: from, contents: contents })
    .select("*")
    .first();

  if (samePlan) {
    res.status(409).json({ message: "Same plan already exists" });
    return;
  }

  let planData = await db("userid")
    .where({ owner: uid })
    .select("planId")
    .first();
  if (!planData) {
    await db("userid").insert({
      owner: uid,
      folderId: 1,
      plannerId: 1,
      planId: 1,
    });
    planData = await db("userid")
      .where({ owner: uid })
      .select("planId")
      .first();
  }
  const planId = planData.planId;
  await db("userid")
    .where({ owner: uid })
    .update({ planId: planId + 1 });

  await db("plan").insert({
    owner: uid,
    startDate: formattedStartDate,
    dueDate: formattedDueDate,
    contents: contents,
    id: planId,
    from: planner.id,
    priority: priority,
    isCompleted: 0,
  });
});

router.post("/createRootFolder", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const isRootFolderExist = await db("folders")
    .where({ owner: uid, id: 0 })
    .select("*")
    .first();

  if (isRootFolderExist) {
    res.status(409).json({ message: "Root folder already exists" });
    return;
  }

  await db("folders").insert({ owner: uid, name: "Root", id: 0, from: -1 });
  res.status(201).json({ message: "Root folder created" });
});

router.post("/addPlanner", async (req, res) => {
  const { name, isDaily, from } = req.body;
  console.log(name, isDaily, from);

  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const folder = await db("folders") //from 값을 받아서 그에 맞는 folder 테이블을 조회
    .where({ owner: uid, id: from })
    .select("*")
    .first();

  if (!folder) {
    res.status(404).json({ message: "Folder not found" });
    return;
  }

  // 같은 from 내에 같은 이름의 planner가 있는지 확인
  const samePlanner = await db("planner")
    .where({ owner: uid, from: from, name: name })
    .select("*")
    .first();
  if (samePlanner) {
    res.status(409).json({ message: "Same planner already exists" });
    return;
  }

  let plannerData = await db("userid")
    .where({ owner: uid })
    .select("plannerId")
    .first();
  if (!plannerData) {
    await db("userid").insert({
      owner: uid,
      plannerId: 1,
      folderId: 1,
      planId: 1,
    });
    plannerData = await db("userid")
      .where({ owner: uid })
      .select("plannerId")
      .first();
  }
  const plannerId = plannerData.plannerId;

  await db("userid")
    .where({ owner: uid })
    .update({ plannerId: plannerId + 1 });

  await db("planner").insert({
    owner: uid,
    name: name,
    id: plannerId,
    from: folder.id,
    isDaily: isDaily,
  });
  res.status(201).json({ message: "Planner added successfully" });
});

router.post("/addFolder", async (req, res) => {
  const { name, from } = req.body;
  if (!name || !from) {
    res.status(400).json({ message: "Name and from are required" });
    return;
  }
  if (folderNameBlacklist.includes(name)) {
    res.status(400).json({ message: "Invalid folder name" });
    return;
  }

  if (name.endsWith(".pn")) {
    res.status(400).json({ message: "Invalid folder name" });
    return;
  }

  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  if (from !== -1) {
    const folder = await db("folders") //from 값을 받아서 그에 맞는 folder 테이블을 조회
      .where({ owner: uid, id: from })
      .select("*")
      .first();

    if (!folder) {
      res.status(404).json({ message: "Folder not found" });
      return;
    }
  }

  let folderData = await db("userid")
    .where({ owner: uid })
    .select("folderId")
    .first();
  if (!folderData) {
    await db("userid").insert({
      owner: uid,
      folderId: 1,
      plannerId: 1,
      planId: 1,
    });
    folderData = await db("userid")
      .where({ owner: uid })
      .select("folderId")
      .first();
  }
  const folderId = folderData.folderId;
  await db("userid")
    .where({ owner: uid })
    .update({ folderId: folderId + 1 });
  await db("folders").insert({
    owner: uid,
    name: name,
    id: folderId,
    from: from,
  });
});

router.get("/getEveryPlan", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const plans = await db("plan").where({ owner: uid }).select("*");

  if (plans.length === 0) {
    res.status(404).json({ message: "Plan not found" });
  } else {
    res.status(200).json(plans);
  }
});

router.get("/getPlanner", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const id = req.query.id;
  let planner;

  if (!id) {
    const from = req.query.from;
    const name = req.query.name;

    if (!name || !from) {
      res.status(400).json({ message: "Id or (from + name) is required" });
      return;
    }

    planner = await db("planner")
      .where({ owner: uid, from: from, name: name })
      .select("*")
      .first();
  } else {
    planner = await db("planner")
      .where({ owner: uid, id: id })
      .select("*")
      .first();
  }

  const plans = await db("plan")
    .where({ owner: uid, from: planner.id })
    .orderByRaw("isCompleted ASC, priority ASC, id ASC")
    .select("*");

  if (plans.length === 0) {
    res.status(404).json({ message: "Plan not found" });
  } else {
    res.status(200).json(plans);
  }
});

router.get("/getPlannersInFolder", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const id = req.query.id;
  let folder;

  if (!id) {
    const from = req.query.from;
    const name = req.query.name;

    if (!name || !from) {
      res.status(400).json({ message: "Id or (from + name) is required" });
      return;
    }

    try {
      folder = await db("folders")
        .where({ owner: uid, from: from, name: name })
        .select("*")
        .first();
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error retrieving folder", error: error.message });
      return;
    }
  } else {
    try {
      folder = await db("folders")
        .where({ owner: uid, id: id })
        .select("*")
        .first();
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error retrieving folder", error: error.message });
      return;
    }
  }

  let planners;
  try {
    planners = await db("planner")
      .where({ owner: uid, from: folder.id })
      .orderByRaw("isDaily ASC, id ASC")
      .select("*");
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving planners", error: error.message });
    return;
  }

  if (planners.length === 0) {
    res.status(404).json({ message: "Planner not found" });
  } else {
    res.status(200).json(planners);
  }
});

router.get("/getFoldersInFolder", async (req, res) => {
  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;
  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const id = req.query.id;
  let folder;

  if (!id) {
    const from = req.query.from;
    const name = req.query.name;

    if (!name || !from) {
      res.status(400).json({ message: "Id or (from + name) is required" });
      return;
    }

    folder = await db("folders")
      .where({ owner: uid, from: from, name: name })
      .select("*")
      .first();
  } else {
    folder = await db("folders")
      .where({ owner: uid, id: id })
      .select("*")
      .first();
  }

  let folders;
  try {
    folders = await db("folders")
      .where({ owner: uid, from: folder.id })
      .orderByRaw("id ASC")
      .select("*");
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving folders", error: error.message });
    return;
  }

  if (folders.length === 0) {
    res.status(404).json({ message: "Folders not found" });
  } else {
    res.status(200).json(folders);
  }
});

module.exports = router;
