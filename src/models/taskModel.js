/**
 * 계획 모델
 * 암호화와 함께 모든 계획 관련 데이터베이스 작업을 처리합니다
 */
const db = require("../config/db");
const { getNextId } = require("../utils/dbUtils");
const {
  hashUserId,
  encryptData,
  decryptData,
  getTimestamp,
} = require("../utils/cryptoUtils");
const logger = require("../utils/logger");

/**
 * 날짜 문자열을 YYYY-MM-DD 형식으로 포맷팅
 * @param {string|null} dateString - 날짜 문자열 또는 null
 * @returns {string|null} - 포맷팅된 날짜 또는 null
 */
const formatDate = (dateString) => {
  if (!dateString) return null;
  return new Date(dateString).toISOString().slice(0, 10);
};

/**
 * 새 작업 생성
 * @param {string} uid - 사용자 ID
 * @param {string} contents - 작업 내용
 * @param {number} plannerId - 플래너 ID
 * @param {string|null} startDate - 시작 날짜 (YYYY-MM-DD)
 * @param {string|null} dueDate - 마감 날짜 (YYYY-MM-DD)
 * @param {number} priority - 우선순위 (기본값: 1)
 * @returns {Promise<Object>} - 생성된 작업 데이터
 */
const createTask = async (
  uid,
  contents,
  plannerId,
  startDate = null,
  dueDate = null,
  priority = 1,
) => {
  try {
    const hashedUid = hashUserId(uid);

    // 플래너가 존재하는지 확인
    const planner = await db("planner")
      .where({ owner: hashedUid, id: plannerId })
      .first();

    if (!planner) {
      throw new Error("플래너를 찾을 수 없습니다");
    }

    // 다음 계획 ID 가져오기
    const planId = await getNextId(hashedUid, "planId");

    // 날짜 포맷팅
    const formattedStartDate = formatDate(startDate);
    const formattedDueDate = formatDate(dueDate);

    // 계획 내용 암호화
    const encryptedContents = encryptData(uid, contents);

    // 암호화된 데이터로 계획 생성
    await db("plan").insert({
      owner: hashedUid,
      startDate: formattedStartDate,
      dueDate: formattedDueDate,
      contents: encryptedContents,
      id: planId,
      from: plannerId,
      priority: priority || 1,
      isCompleted: 0,
      created_at: getTimestamp(),
    });

    // 응답용 평문 데이터 반환
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

/**
 * 복호화된 내용과 함께 ID로 작업 가져오기
 * @param {string} uid - 사용자 ID
 * @param {number} id - 작업 ID
 * @returns {Promise<Object|null>} - 작업 데이터 또는 찾지 못한 경우 null
 */
const getTaskById = async (uid, id) => {
  try {
    const hashedUid = hashUserId(uid);
    const task = await db("plan").where({ owner: hashedUid, id: id }).first();

    if (!task) return null;

    // 작업 내용 복호화
    return {
      ...task,
      owner: uid, // 애플리케이션 로직을 위해 원본 ID 사용
      contents: decryptData(uid, task.contents),
    };
  } catch (error) {
    logger.error("ID로 작업 가져오기 오류:", error);
    throw error;
  }
};

/**
 * 복호화된 내용과 함께 작업 가져오기 (특정 플래너 또는 전체)
 * @param {string} uid - 사용자 ID
 * @param {number|null} plannerId - 플래너 ID (없으면 모든 작업 가져옴)
 * @param {boolean|null} isCompleted - 완료 상태 (null이면 모든 상태 가져옴)
 * @returns {Promise<Array>} - 작업 객체 배열
 */
const getTasks = async (uid, plannerId = null, isCompleted = null) => {
  try {
    const hashedUid = hashUserId(uid);

    // 특정 플래너의 작업을 요청한 경우, 플래너가 존재하는지 확인
    if (plannerId !== null) {
      const planner = await db("planner")
        .where({ owner: hashedUid, id: plannerId })
        .first();

      if (!planner) {
        throw new Error("플래너를 찾을 수 없습니다");
      }
    }

    // 쿼리 구성
    let query = db("plan").where({ owner: hashedUid });

    // 특정 플래너의 작업만 필터링
    if (plannerId !== null) {
      query = query.where({ from: plannerId });
    }

    if (isCompleted !== null) {
      query = query.where({ isCompleted: isCompleted === "true" ? 1 : 0 });
    }

    // 정렬 적용
    const tasks = await query.orderByRaw(
      "isCompleted ASC, priority DESC, id ASC",
    );

    // 작업 내용 복호화
    return tasks.map((task) => ({
      ...task,
      owner: uid, // 애플리케이션 로직을 위해 원본 ID 사용
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

/**
 * 작업 업데이트
 * @param {string} uid - 사용자 ID
 * @param {number} id - 작업 ID
 * @param {Object} updateData - 업데이트할 데이터
 * @returns {Promise<Object>} - 업데이트된 작업 데이터
 */
const updateTask = async (uid, id, updateData) => {
  try {
    const hashedUid = hashUserId(uid);
    const task = await db("plan").where({ owner: hashedUid, id: id }).first();

    if (!task) {
      throw new Error("작업을 찾을 수 없습니다");
    }

    // 제공된 경우 날짜 포맷팅
    const formattedData = { ...updateData };
    if (formattedData.startDate !== undefined) {
      formattedData.startDate = formatDate(formattedData.startDate);
    }
    if (formattedData.dueDate !== undefined) {
      formattedData.dueDate = formatDate(formattedData.dueDate);
    }

    // 제공된 경우 내용 암호화
    if (formattedData.contents !== undefined) {
      formattedData.contents = encryptData(uid, formattedData.contents);
    }

    // 업데이트 타임스탬프 추가
    formattedData.updated_at = getTimestamp();

    await db("plan").where({ owner: hashedUid, id: id }).update(formattedData);

    // 복호화된 내용과 함께 업데이트된 작업 가져오기
    return await getTaskById(uid, id);
  } catch (error) {
    logger.error("작업 업데이트 오류:", error);
    throw error;
  }
};

/**
 * 작업 삭제
 * @param {string} uid - 사용자 ID
 * @param {number} id - 작업 ID
 * @returns {Promise<boolean>} - 성공 상태
 */
const deleteTask = async (uid, id) => {
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

/**
 * 작업을 완료로 표시
 * @param {string} uid - 사용자 ID
 * @param {number} id - 작업 ID
 * @returns {Promise<Object>} - 업데이트된 계획 데이터
 */
const completeTask = async (uid, id) => {
  try {
    const hashedUid = hashUserId(uid);
    const task = await db("plan").where({ owner: hashedUid, id: id }).first();

    if (!task) {
      throw new Error("작업을 찾을 수 없습니다");
    }

    await db("plan").where({ owner: hashedUid, id: id }).update({
      isCompleted: 1,
      updated_at: getTimestamp(),
    });

    // 복호화된 내용과 함께 업데이트된 작업 가져오기
    return await getTaskById(uid, id);
  } catch (error) {
    logger.error("작업 완료 처리 오류:", error);
    throw error;
  }
};

module.exports = {
  createTask,
  getTaskById,
  getTasks,
  updateTask,
  deleteTask,
  completeTask,
};
