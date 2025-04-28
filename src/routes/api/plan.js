const express = require("express");
const db = require("../../config/db");
const router = express.Router();

const folderNameBlacklist = ["Root", "root", "new", "all"];

//---------------- Plan Related Routes ----------------//

router.post("/addPlan", async (req, res) => {
  const { contents, priority, from } = req.body;
  console.log(contents, priority, from);

  if (!contents || !from) {
    res.status(400).json({ message: "Contents and from are required" });
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
  res.status(201).json({ message: "Plan added successfully" });
});

router.post("/updatePlan", async (req, res) => {
  const { id, startDate, dueDate, contents, priority, from, isCompleted } =
    req.body;

  const uid =
    req.session &&
    req.session.passport &&
    req.session.passport.user &&
    req.session.passport.user.id;

  if (!id) {
    res.status(400).json({ message: "Id is required" });
    return;
  }

  if (!uid) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  if (
    startDate === undefined &&
    dueDate === undefined &&
    contents === undefined &&
    priority === undefined &&
    from === undefined &&
    isCompleted === undefined
  ) {
    res.status(400).json({ message: "Data is required" });
    return;
  }

  await db("plan").where({ owner: uid, id: id }).update({
    startDate: startDate,
    dueDate: dueDate,
    contents: contents,
    priority: priority,
    from: from,
    isCompleted: isCompleted,
  });

  res.status(200).json({ message: "Plan updated successfully" });
});

router.post("/deletePlan", async (req, res) => {
  const { id } = req.body;
  if (!id) {
    res.status(400).json({ message: "Id is required" });
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

  await db("plan").where({ owner: uid, id: id }).del();

  res.status(200).json({ message: "Plan deleted successfully" });
});

router.post("/completePlan", async (req, res) => {
  const { id } = req.body;
  if (!id) {
    res.status(400).json({ message: "Id is required" });
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

  await db("plan").where({ owner: uid, id: id }).update({ isCompleted: 1 });

  res.status(200).json({ message: "Plan completed successfully" });
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

router.get("/getPlanInPlanner", async (req, res) => {
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
    res.status(400).json({ message: "Id is required" });
    return;
  }

  planner = await db("planner")
    .where({ owner: uid, id: id })
    .select("*")
    .first();

  if (!planner) {
    res.status(404).json({ message: "Planner not found" });
    return;
  }

  const plans = await db("plan")
    .where({ owner: uid, from: planner.id })
    .orderByRaw("isCompleted ASC, priority DESC, id ASC")
    .select("*");

  res.status(200).json(plans);
});

//---------------- Planner Related Routes ----------------//

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

router.post("/renamePlanner", async (req, res) => {
  const { id, name } = req.body;

  if (!id || !name) {
    res.status(400).json({ message: "Id and name are required" });
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

  const planner = await db("planner")
    .where({ owner: uid, id: id })
    .select("*")
    .first();

  if (!planner) {
    res.status(404).json({ message: "Planner not found" });
    return;
  }

  // 같은 폴더에 같은 이름의 플래너가 있는지 확인
  const samePlanner = await db("planner")
    .where({ owner: uid, from: planner.from, name: name })
    .whereNot({ id: id })
    .select("*")
    .first();

  if (samePlanner) {
    res.status(409).json({
      message: "Planner with same name already exists in this folder",
    });
    return;
  }

  await db("planner").where({ owner: uid, id: id }).update({ name: name });

  res.status(200).json({ message: "Planner renamed successfully" });
});

router.post("/deletePlanner", async (req, res) => {
  const { id } = req.body;

  if (!id) {
    res.status(400).json({ message: "Id is required" });
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

  const planner = await db("planner")
    .where({ owner: uid, id: id })
    .select("*")
    .first();

  if (!planner) {
    res.status(404).json({ message: "Planner not found" });
    return;
  }

  // 트랜잭션 시작: 플래너와 관련된 모든
  try {
    await db.transaction(async (trx) => {
      // 해당 플래너에 속한 모든 플랜 삭제
      await trx("plan").where({ owner: uid, from: id }).del();

      // 플래너 삭제
      await trx("planner").where({ owner: uid, id: id }).del();
    });

    res.status(200).json({
      message: "Planner and all associated plans deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error deleting planner", error: error.message });
  }
});

router.get("/getPlannerInfoByID", async (req, res) => {
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
  if (!id) {
    res.status(400).json({ message: "Bad Request" });
    return;
  }

  let planner;
  try {
    planner = await db("planner")
      .where({ owner: uid, id: id })
      .orderByRaw("isDaily ASC, id ASC")
      .select("*")
      .first();
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error retrieving planner", error: error.message });
    return;
  }

  if (!planner) {
    res.status(404).json({ message: "Planner not found" });
  } else {
    res.status(200).json(planner);
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

//---------------- Folder Related Routes ----------------//

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
