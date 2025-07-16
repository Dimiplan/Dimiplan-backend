import { getUser, isRegistered, updateUser } from "../models/user.mjs";
import logger from "../utils/logger.mjs";

const validateUserData = (userData) => {
  if (userData.name && userData.name.toString().length > 15) {
    return false;
  }

  if (
    userData.grade &&
    (Number.isNaN(parseInt(userData.grade)) ||
      parseInt(userData.grade) > 3 ||
      parseInt(userData.grade) < 1)
  ) {
    return false;
  }

  if (
    userData.class &&
    (Number.isNaN(parseInt(userData.class)) ||
      parseInt(userData.class) > 6 ||
      parseInt(userData.class) < 1)
  ) {
    return false;
  }

  return true;
};

export const updateUserInfo = async (userId, requestData) => {
  const { name, grade, class: classInput, email, profile_image } = requestData;

  const userData = {
    name: name ? name.toString() : undefined,
    grade: grade ? parseInt(grade) : undefined,
    class: classInput ? parseInt(classInput) : undefined,
    email: email ? email.toString() : undefined,
    profile_image: profile_image ? profile_image.toString() : undefined,
  };

  if (!validateUserData(userData)) {
    throw new Error("INVALID_DATA");
  }

  const cleanedData = Object.keys(userData).reduce((acc, key) => {
    if (userData[key] !== undefined) {
      acc[key] = userData[key];
    }
    return acc;
  }, {});

  if (Object.keys(cleanedData).length === 0) {
    throw new Error("NO_UPDATE_FIELDS");
  }

  await updateUser(userId, cleanedData);
  logger.verbose(`사용자 ${userId} 정보 업데이트 완료`);
};

export const checkUserRegistration = async (userId) => {
  const registered = await isRegistered(userId);
  logger.verbose(`사용자 ${userId} 등록 상태: ${registered}`);
  return registered;
};

export const getUserInfo = async (userId) => {
  const user = await getUser(userId);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  logger.verbose(`사용자 ${userId} 정보 조회 성공`);
  return user;
};
