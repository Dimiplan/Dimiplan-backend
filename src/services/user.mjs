/**
 * 사용자 서비스
 * 사용자 관련 비즈니스 로직을 담당합니다
 */
import { getUser, isRegistered, updateUser } from "../models/user.mjs";
import logger from "../utils/logger.mjs";

/**
 * 사용자 데이터 유효성 검사
 * 사용자가 입력한 데이터의 유효성을 검증합니다
 * @param userData
 * @returns {boolean} 유효성 검사 결과
 */
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

/**
 * 사용자 정보 업데이트 서비스
 * @param userId
 * @param requestData
 */
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

/**
 * 사용자 등록 상태 확인 서비스
 * @param userId
 * @returns {Promise<object>} 등록 상태 객체
 */
export const checkUserRegistration = async (userId) => {
  const registered = await isRegistered(userId);
  logger.verbose(`사용자 ${userId} 등록 상태: ${registered}`);
  return { registered };
};

/**
 * 사용자 정보 조회 서비스
 * @param userId
 * @returns {Promise<object>} 사용자 정보 객체
 */
export const getUserInfo = async (userId) => {
  const user = await getUser(userId);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  logger.verbose(`사용자 ${userId} 정보 조회 성공`);
  return user;
};
