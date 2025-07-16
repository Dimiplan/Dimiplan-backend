import db from "../config/db.mjs";
import {
  decryptData,
  encryptData,
  getTimestamp,
  hashUserId,
} from "../utils/crypto.mjs";
import { executeTransaction, getNextId } from "../utils/db.mjs";
import logger from "../utils/logger.mjs";

export const createPlanner = async (uid, name, isDaily) => {
  try {
    const hashedUid = hashUserId(uid);

    const existingPlanner = await db("planner")
      .where({
        owner: hashedUid,
        name: encryptData(uid, name),
      })
      .first();

    if (existingPlanner) {
      throw new Error("같은 이름의 플래너가 이미 존재합니다");
    }

    const plannerId = await getNextId(hashedUid, "plannerId");

    await db("planner").insert({
      owner: hashedUid,
      name: encryptData(uid, name),
      id: plannerId,
      isDaily: isDaily ?? 0,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    });

    return {
      owner: uid,
      name: name,
      id: plannerId,
      isDaily: isDaily ?? 0,
    };
  } catch (error) {
    logger.error("플래너 생성 오류:", error);
    throw error;
  }
};

export const getPlannerById = async (uid, id) => {
  try {
    const hashedUid = hashUserId(uid);

    const planner = await db("planner")
      .where({ owner: hashedUid, id: id })
      .first();

    if (!planner) {
      return null;
    }

    return {
      ...planner,
      owner: uid,
      name: decryptData(uid, planner.name),
    };
  } catch (error) {
    logger.error("ID로 플래너 가져오기 오류:", error);
    throw error;
  }
};

export const getPlanners = async (uid) => {
  try {
    const hashedUid = hashUserId(uid);

    const planners = await db("planner")
      .where({ owner: hashedUid })
      .orderByRaw("isDaily ASC, id ASC");

    return planners.map((planner) => ({
      ...planner,
      owner: uid,
      name: decryptData(uid, planner.name),
    }));
  } catch (error) {
    logger.error("플래너 가져오기 오류:", error);
    throw error;
  }
};

export const renamePlanner = async (uid, id, newName) => {
  try {
    const hashedUid = hashUserId(uid);

    const planner = await db("planner")
      .where({ owner: hashedUid, id: id })
      .first();

    if (!planner) {
      throw new Error("플래너를 찾을 수 없습니다");
    }

    const existingPlanner = await db("planner")
      .where({
        owner: hashedUid,
        name: encryptData(uid, newName),
      })
      .whereNot({ id: id })
      .first();

    if (existingPlanner) {
      throw new Error("같은 이름의 플래너가 이미 존재합니다");
    }

    await db("planner")
      .where({ owner: hashedUid, id: id })
      .update({
        name: encryptData(uid, newName),
        updated_at: getTimestamp(),
      });

    return {
      ...planner,
      owner: uid,
      name: newName,
    };
  } catch (error) {
    logger.error("플래너 이름 변경 오류:", error);
    throw error;
  }
};

export const deletePlanner = async (uid, id) => {
  try {
    const hashedUid = hashUserId(uid);

    const planner = await db("planner")
      .where({ owner: hashedUid, id: id })
      .first();

    if (!planner) {
      throw new Error("플래너를 찾을 수 없습니다");
    }

    await executeTransaction(async (trx) => {
      await trx("plan").where({ owner: hashedUid, from: id }).del();
      await trx("planner").where({ owner: hashedUid, id: id }).del();
    });

    logger.info(
      `플래너 삭제됨: ID ${id}, 사용자 ${hashedUid.substring(0, 8)}...`,
    );
    return true;
  } catch (error) {
    logger.error("플래너 삭제 오류:", error);
    throw error;
  }
};
