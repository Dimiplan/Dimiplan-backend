/**
 * 작업 서비스
 * 작업 관련 비즈니스 로직을 담당합니다
 */
import {
  completeTask,
  createTask,
  deleteTask,
  getTasks,
  updateTask,
} from "../models/task.mjs";
import logger from "../utils/logger.mjs";

/**
 * 작업 생성 서비스
 * @param userId
 * @param requestData
 */
export const addTask = async (userId, requestData) => {
  const { contents, priority, from, startDate, dueDate } = requestData;

  if (!contents || !from) {
    throw new Error("REQUIRED_FIELDS_MISSING");
  }

  try {
    await createTask(userId, contents, from, startDate, dueDate, priority);
    logger.verbose(`작업 추가 성공 - 사용자: ${userId}`);
  } catch (error) {
    if (error.message === "플래너를 찾을 수 없습니다") {
      throw new Error("PLANNER_NOT_FOUND");
    }
    throw error;
  }
};

/**
 * 작업 정보 수정 서비스
 * @param userId
 * @param requestData
 */
export const updateTaskInfo = async (userId, requestData) => {
  const { id, contents, priority, from, startDate, dueDate, isCompleted } =
    requestData;

  if (!id) {
    throw new Error("REQUIRED_FIELDS_MISSING");
  }

  const updateData = {};
  if (contents !== undefined) updateData.contents = contents;
  if (priority !== undefined) updateData.priority = priority;
  if (from !== undefined) updateData.from = from;
  if (startDate !== undefined) updateData.startDate = startDate;
  if (dueDate !== undefined) updateData.dueDate = dueDate;
  if (isCompleted !== undefined) updateData.isCompleted = isCompleted;

  if (Object.keys(updateData).length === 0) {
    throw new Error("NO_UPDATE_DATA");
  }

  try {
    await updateTask(userId, id, updateData);
    logger.verbose(`작업 업데이트 성공 - 사용자: ${userId}, 작업ID: ${id}`);
  } catch (error) {
    if (error.message === "작업을 찾을 수 없습니다") {
      throw new Error("TASK_NOT_FOUND");
    }
    throw error;
  }
};

/**
 * 작업 삭제 서비스
 * @param userId
 * @param requestData
 */
export const removeTask = async (userId, requestData) => {
  const { id } = requestData;

  if (!id) {
    throw new Error("REQUIRED_FIELDS_MISSING");
  }

  try {
    await deleteTask(userId, id);
    logger.verbose(`작업 삭제 성공 - 사용자: ${userId}, 작업ID: ${id}`);
  } catch (error) {
    if (error.message === "작업을 찾을 수 없습니다") {
      throw new Error("TASK_NOT_FOUND");
    }
    throw error;
  }
};

/**
 * 작업 완료 처리 서비스
 * @param userId
 * @param requestData
 */
export const markTaskComplete = async (userId, requestData) => {
  const { id } = requestData;

  if (!id) {
    throw new Error("REQUIRED_FIELDS_MISSING");
  }

  try {
    await completeTask(userId, id);
    logger.verbose(`작업 완료 성공 - 사용자: ${userId}, 작업ID: ${id}`);
  } catch (error) {
    if (error.message === "작업을 찾을 수 없습니다") {
      throw new Error("TASK_NOT_FOUND");
    }
    throw error;
  }
};

/**
 * 작업 조회 서비스
 * @param userId
 * @param plannerId
 * @param isCompleted
 * @returns {Promise<Array>} 작업 목록
 */
export const getTaskList = async (userId, plannerId, isCompleted) => {
  try {
    const tasks = await getTasks(userId, plannerId, isCompleted);

    if (tasks.length === 0) {
      throw new Error("TASKS_NOT_FOUND");
    }

    logger.verbose(
      `작업 조회 성공 - 사용자: ${userId}, 플래너ID: ${plannerId}, isCompleted: ${isCompleted}`,
    );
    return tasks;
  } catch (error) {
    if (error.message === "플래너를 찾을 수 없습니다") {
      throw new Error("PLANNER_NOT_FOUND");
    }
    throw error;
  }
};
