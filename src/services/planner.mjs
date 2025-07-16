import {
  createPlanner,
  deletePlanner,
  getPlannerById,
  getPlanners,
  renamePlanner,
} from "../models/planner.mjs";
import logger from "../utils/logger.mjs";

export const addPlanner = async (userId, requestData) => {
  const { name, isDaily } = requestData;

  if (name === undefined) {
    throw new Error("REQUIRED_FIELDS_MISSING");
  }

  await createPlanner(userId, name, isDaily);
  logger.verbose(`플래너 추가 성공 - 사용자: ${userId}`);
};

export const updatePlannerName = async (userId, plannerId, name) => {
  if (!plannerId || !name) {
    throw new Error("REQUIRED_FIELDS_MISSING");
  }

  await renamePlanner(userId, plannerId, name);
  logger.verbose(`플래너 이름 변경 성공 - 사용자: ${userId}, 플래너ID: ${plannerId}`);
};

export const removePlanner = async (userId, plannerId) => {
  if (!plannerId) {
    throw new Error("REQUIRED_FIELDS_MISSING");
  }

  try {
    await deletePlanner(userId, plannerId);
    logger.verbose(`플래너 삭제 성공 - 사용자: ${userId}, 플래너ID: ${plannerId}`);
  } catch (error) {
    if (error.message === "플래너를 찾을 수 없습니다") {
      throw new Error("PLANNER_NOT_FOUND");
    }
    throw error;
  }
};

export const getPlannerInfo = async (userId, plannerId) => {
  if (!plannerId) {
    throw new Error("REQUIRED_FIELDS_MISSING");
  }

  const planner = await getPlannerById(userId, plannerId);

  if (!planner) {
    throw new Error("PLANNER_NOT_FOUND");
  }

  logger.verbose(
    `플래너 정보 조회 성공 - 사용자: ${userId}, 플래너ID: ${plannerId}`,
  );
  return planner;
};

export const getAllPlanners = async (userId) => {
  const planners = await getPlanners(userId);

  if (planners.length === 0) {
    throw new Error("PLANNERS_NOT_FOUND");
  }

  logger.verbose(
    `플래너 목록 조회 성공 - 사용자: ${userId}, 플래너 수: ${planners.length}`,
  );
  return planners;
};
