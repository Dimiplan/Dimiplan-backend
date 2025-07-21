import db from "../config/db.mjs";
import { decryptData, hashUserId, isEncrypted } from "../utils/crypto.mjs";
import { formatDateForMySQL } from "../utils/date.mjs";
import logger from "../utils/logger.mjs";

export const isUserExists = async (uid) => {
  try {
    const hashedUid = hashUserId(uid);
    const count = await db("users").where("id", hashedUid).count("* as count");
    return parseInt(count[0].count, 10) > 0;
  } catch (error) {
    logger.error("사용자 존재 여부 확인 오류:", error);
    throw error;
  }
};

export const createUser = async (user) => {
  try {
    if (!(await isUserExists(user.id))) {
      const hashedUid = hashUserId(user.id);
      const encryptedUser = {
        id: hashedUid,
        name: user.name,
        grade: user.grade,
        class: user.class,
        email: user.email,
        profile_image: user.profile_image,
      };

      const timestamp = formatDateForMySQL();
      encryptedUser.created_at = timestamp;
      encryptedUser.updated_at = timestamp;

      await db("users").insert(encryptedUser);

      await db("userid").insert({
        owner: hashedUid,
        plannerId: 1,
        planId: 1,
        roomId: 1,
        chatId: 1,
        created_at: timestamp,
      });

      logger.info(`사용자 생성됨: ${hashedUid.substring(0, 8)}...`);
    }
  } catch (error) {
    logger.error("사용자 생성 오류:", error);
    throw error;
  }
};

export const getUser = async (uid) => {
  try {
    const hashedUid = hashUserId(uid);
    const users = await db("users").where("id", hashedUid).select("*");

    if (!users[0]) return null;

    const user = users[0];

    user.name = isEncrypted(user.name)
      ? decryptData(uid, user.name)
      : user.name;
    user.email = isEncrypted(user.email)
      ? decryptData(uid, user.email)
      : user.email;
    user.profile_image = isEncrypted(user.profile_image)
      ? decryptData(uid, user.profile_image)
      : user.profile_image;

    if (user !== users[0]) {
      updateUser(uid, user);
    }

    return {
      id: uid,
      name: user.name,
      grade: user.grade,
      class: user.class,
      email: user.email,
      profile_image: user.profile_image,
    };
  } catch (error) {
    logger.error("사용자 가져오기 오류:", error);
    throw error;
  }
};

export const updateUser = async (uid, userData) => {
  try {
    const hashedUid = hashUserId(uid);

    const encryptedData = {};

    if (userData.name !== undefined) {
      encryptedData.name = userData.name;
    }

    if (userData.email !== undefined) {
      encryptedData.email = userData.email;
    }

    if (userData.profile_image !== undefined) {
      encryptedData.profile_image = userData.profile_image;
    }

    if (userData.grade !== undefined) {
      encryptedData.grade = userData.grade;
    }

    if (userData.class !== undefined) {
      encryptedData.class = userData.class;
    }

    encryptedData.updated_at = formatDateForMySQL();

    return await db("users").where("id", hashedUid).update(encryptedData);
  } catch (error) {
    logger.error("사용자 업데이트 오류:", error);
    throw error;
  }
};

export const isRegistered = async (uid) => {
  try {
    const user = await getUser(uid);
    return user !== null && user.name !== null;
  } catch (error) {
    logger.error("사용자 등록 여부 확인 오류:", error);
    throw error;
  }
};
