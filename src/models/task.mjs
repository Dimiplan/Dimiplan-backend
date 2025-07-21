import db from "../config/db.mjs";
import { decryptData, encryptData, hashUserId } from "../utils/crypto.mjs";
import { formatDateForMySQL } from "../utils/date.mjs";
import { getNextId } from "../utils/db.mjs";
import logger from "../utils/logger.mjs";

export const formatDate = (dateString) => {
  if (!dateString) return null;
  return new Date(dateString).toISOString().slice(0, 10);
};

export const createTask = async (
  uid,
  contents,
  plannerId,
  startDate = null,
  dueDate = null,
  priority = 1,
) => {
  try {
    const hashedUid = hashUserId(uid);

    const planner = await db("planner")
      .where({ owner: hashedUid, id: plannerId })
      .first();

    if (!planner) {
      throw new Error("플래너를 찾을 수 없습니다");
    }

    const planId = await getNextId(hashedUid, "planId");

    const formattedStartDate = formatDate(startDate);
    const formattedDueDate = formatDate(dueDate);

    const encryptedContents = encryptData(uid, contents);

    await db("plan").insert({
      owner: hashedUid,
      startDate: formattedStartDate,
      dueDate: formattedDueDate,
      contents: encryptedContents,
      id: planId,
      from: plannerId,
      priority: priority || 1,
      isCompleted: 0,
      created_at: formatDateForMySQL(),
    });

    return {
      owner: uid,
      startDate: formattedStartDate,
      dueDate: formattedDueDate,
      contents: contents,
      id: planId,
      from: plannerId,
      priority: priority || 1,
      isCompleted: 0,
    };
  } catch (error) {
    logger.error("계획 생성 오류:", error);
    throw error;
  }
};

export const getTaskById = async (uid, id) => {
  try {
    const hashedUid = hashUserId(uid);
    const task = await db("plan").where({ owner: hashedUid, id: id }).first();

    if (!task) return null;

    return {
      ...task,
      owner: uid,
      contents: decryptData(uid, task.contents),
    };
  } catch (error) {
    logger.error("ID로 작업 가져오기 오류:", error);
    throw error;
  }
};

export const getTasks = async (uid, plannerId = null, isCompleted = null) => {
  try {
    const hashedUid = hashUserId(uid);

    if (plannerId !== null) {
      const planner = await db("planner")
        .where({ owner: hashedUid, id: plannerId })
        .first();

      if (!planner) {
        throw new Error("플래너를 찾을 수 없습니다");
      }
    }

    let query = db("plan").where({ owner: hashedUid });

    if (plannerId !== null) {
      query = query.where({ from: plannerId });
    }

    if (isCompleted !== null) {
      query = query.where({
        isCompleted: isCompleted === "true" ? 1 : 0,
      });
    }

    const tasks = await query.orderByRaw(
      "isCompleted ASC, priority DESC, id ASC",
    );

    return tasks.map((task) => ({
      ...task,
      owner: uid,
      contents: decryptData(uid, task.contents),
    }));
  } catch (error) {
    const errorMsg = plannerId
      ? "플래너의 작업 가져오기 오류:"
      : "모든 작업 가져오기 오류:";
    logger.error(errorMsg, error);
    throw error;
  }
};

export const updateTask = async (uid, id, updateData) => {
  try {
    const hashedUid = hashUserId(uid);
    const task = await db("plan").where({ owner: hashedUid, id: id }).first();

    if (!task) {
      throw new Error("작업을 찾을 수 없습니다");
    }

    const formattedData = { ...updateData };
    if (formattedData.startDate !== undefined) {
      formattedData.startDate = formatDate(formattedData.startDate);
    }
    if (formattedData.dueDate !== undefined) {
      formattedData.dueDate = formatDate(formattedData.dueDate);
    }

    if (formattedData.contents !== undefined) {
      formattedData.contents = encryptData(uid, formattedData.contents);
    }

    formattedData.updated_at = formatDateForMySQL();

    await db("plan").where({ owner: hashedUid, id: id }).update(formattedData);

    return await getTaskById(uid, id);
  } catch (error) {
    logger.error("작업 업데이트 오류:", error);
    throw error;
  }
};

export const deleteTask = async (uid, id) => {
  try {
    const hashedUid = hashUserId(uid);
    const task = await db("plan").where({ owner: hashedUid, id: id }).first();

    if (!task) {
      throw new Error("작업을 찾을 수 없습니다");
    }

    await db("plan").where({ owner: hashedUid, id: id }).del();

    logger.info(
      `작업 삭제됨: ${hashedUid.substring(0, 8)}... - 작업 ID: ${id}`,
    );
    return true;
  } catch (error) {
    logger.error("작업 삭제 오류:", error);
    throw error;
  }
};
