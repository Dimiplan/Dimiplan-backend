/**
 * 계획/작업 모델
 * 암호화와 함께 모든 계획/작업 관련 데이터베이스 작업을 처리합니다
 * 작업 생성, 조회, 수정, 삭제, 완료 처리 기능과 내용 암호화/복호화를 제공합니다
 *
 * @fileoverview 플래너 내 작업 관리 시스템의 데이터 모델 모듈
 */
import db from "../config/db.mjs";
import {
  decryptData,
  encryptData,
  getTimestamp,
  hashUserId,
} from "../utils/crypto.mjs";
import { getNextId } from "../utils/db.mjs";
import logger from "../utils/logger.mjs";

/**
 * 날짜 문자열을 YYYY-MM-DD 형식으로 포맷팅
 * JavaScript Date 객체로 변환 후 MySQL 날짜 형식으로 리포맷팅합니다
 * null 또는 빈 문자열인 경우 null을 반환합니다
 *
 * @function formatDate
 * @param {string|null} dateString - 날짜 문자열 또는 null
 * @returns {string|null} 포맷팅된 날짜 (YYYY-MM-DD) 또는 null
 * @example
 * formatDate('2023-12-25T14:30:45'); // '2023-12-25'
 * formatDate(null); // null
 * formatDate(''); // null
 */
export const formatDate = (dateString) => {
  if (!dateString) return null;
  return new Date(dateString).toISOString().slice(0, 10);
};

// eslint-disable-next-line jsdoc/require-returns
/**
 * 새 작업 생성
 * 지정된 플래너에 새 작업을 생성합니다. 플래너 존재 여부를 확인하고,
 * 작엄 내용을 암호화하여 데이터베이스에 저장합니다
 *
 * @async
 * @function createTask
 * @param {string} uid - 사용자 ID (평문)
 * @param {string} contents - 작업 내용
 * @param {number} plannerId - 플래너 ID
 * @param {string|null} [startDate=null] - 시작 날짜 (YYYY-MM-DD 형식)
 * @param {string|null} [dueDate=null] - 마감 날짜 (YYYY-MM-DD 형식)
 * @param {number} [priority=1] - 우선순위 (1-5, 높을수록 중요)
 * @returns {Promise<object>} 생성된 작업 데이터
 * @returns {string} returns.owner - 사용자 ID (평문)
 * @returns {string} returns.contents - 작업 내용 (평문)
 * @returns {number} returns.id - 작업 ID
 * @returns {number} returns.from - 플래너 ID
 * @returns {string|null} returns.startDate - 시작 날짜
 * @returns {string|null} returns.dueDate - 마감 날짜
 * @returns {number} returns.priority - 우선순위
 * @returns {number} returns.isCompleted - 완료 상태 (0: 미완료)
 * @throws {Error} 플래너를 찾을 수 없거나 데이터베이스 오류 시 예외 발생
 * @example
 * const task = await createTask('user123', '회의 준비', 1, '2023-12-25', '2023-12-26', 3);
 * console.log(task.id); // 새 작업 ID
 */
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
 * 지정된 ID의 작업을 데이터베이스에서 조회하고 암호화된 내용을 복호화하여 반환합니다
 * 작업이 존재하지 않으면 null을 반환합니다
 *
 * @async
 * @function getTaskById
 * @param {string} uid - 사용자 ID (평문)
 * @param {number} id - 작업 ID
 * @returns {Promise<object | null>} 작업 데이터 또는 찾지 못한 경우 null
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * const task = await getTaskById('user123', 5);
 * if (task) {
 *   console.log(task.contents); // '복호화된 작업 내용'
 * }
 */
export const getTaskById = async (uid, id) => {
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

// eslint-disable-next-line jsdoc/require-returns
/**
 * 복호화된 내용과 함께 작업 가져오기 (특정 플래너 또는 전체)
 * 사용자의 작업을 조회합니다. 플래너 ID와 완료 상태에 따라 필터링할 수 있습니다
 * 암호화된 작업 내용을 복호화하여 평문으로 반환하고, 우선순위와 ID 순으로 정렬합니다
 *
 * @async
 * @function getTasks
 * @param {string} uid - 사용자 ID (평문)
 * @param {number|null} [plannerId=null] - 플래너 ID (없으면 모든 작업 가져옴)
 * @param {boolean|string|null} [isCompleted=null] - 완료 상태 (null이면 모든 상태, 'true'/true: 완료된 작업, 'false'/false: 미완료 작업)
 * @returns {Promise<Array<object>>} 작업 객체 배열
 * @returns {string} returns[].owner - 사용자 ID (평문)
 * @returns {string} returns[].contents - 작업 내용 (복호화된 평문)
 * @returns {number} returns[].id - 작업 ID
 * @returns {number} returns[].from - 플래너 ID
 * @returns {string|null} returns[].startDate - 시작 날짜
 * @returns {string|null} returns[].dueDate - 마감 날짜
 * @returns {number} returns[].priority - 우선순위
 * @returns {number} returns[].isCompleted - 완료 상태
 * @throws {Error} 플래너를 찾을 수 없거나 데이터베이스 오류 시 예외 발생
 * @example
 * // 모든 작업 조회
 * const allTasks = await getTasks('user123');
 *
 * // 특정 플래너의 미완료 작업 조회
 * const pendingTasks = await getTasks('user123', 1, false);
 */
export const getTasks = async (uid, plannerId = null, isCompleted = null) => {
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
      query = query.where({
        isCompleted: isCompleted === "true" ? 1 : 0,
      });
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
 * 지정된 작업의 정보를 업데이트합니다. 작업이 존재하는지 확인하고,
 * 제공된 데이터를 기반으로 날짜 포맷팅 및 내용 암호화를 수행합니다
 *
 * @async
 * @function updateTask
 * @param {string} uid - 사용자 ID (평문)
 * @param {number} id - 업데이트할 작업 ID
 * @param {object} updateData - 업데이트할 데이터
 * @param {string} [updateData.contents] - 업데이트할 작업 내용
 * @param {number} [updateData.priority] - 업데이트할 우선순위
 * @param {number} [updateData.from] - 업데이트할 플래너 ID
 * @param {string} [updateData.startDate] - 업데이트할 시작 날짜
 * @param {string} [updateData.dueDate] - 업데이트할 마감 날짜
 * @param {number} [updateData.isCompleted] - 업데이트할 완료 상태
 * @returns {Promise<object>} 업데이트된 작업 데이터 (복호화된 내용 포함)
 * @throws {Error} 작업을 찾을 수 없거나 데이터베이스 오류 시 예외 발생
 * @example
 * const updated = await updateTask('user123', 5, {
 *   contents: '수정된 작업 내용',
 *   priority: 3,
 *   dueDate: '2023-12-31'
 * });
 */
export const updateTask = async (uid, id, updateData) => {
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
 * 지정된 작업이 존재하는지 확인한 후 데이터베이스에서 삭제합니다
 * 삭제 성공 시 로그에 기록하고 true를 반환합니다
 *
 * @async
 * @function deleteTask
 * @param {string} uid - 사용자 ID (평문)
 * @param {number} id - 삭제할 작업 ID
 * @returns {Promise<boolean>} 삭제 성공 여부 (true: 성공)
 * @throws {Error} 작업을 찾을 수 없을 때 또는 데이터베이스 오류 시 예외 발생
 * @example
 * try {
 *   const deleted = await deleteTask('user123', 5);
 *   console.log('작업 삭제 성공');
 * } catch (error) {
 *   console.error('작업을 찾을 수 없습니다');
 * }
 */
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

/**
 * 작업을 완료로 표시
 * 지정된 작업의 완료 상태를 1로 설정하고 업데이트 시간을 기록합니다
 * 작업이 존재하는지 확인한 후 완료 처리하고 복호화된 데이터를 반환합니다
 *
 * @async
 * @function completeTask
 * @param {string} uid - 사용자 ID (평문)
 * @param {number} id - 완료 처리할 작업 ID
 * @returns {Promise<object>} 업데이트된 작업 데이터 (복호화된 내용 포함)
 * @throws {Error} 작업을 찾을 수 없을 때 또는 데이터베이스 오류 시 예외 발생
 * @example
 * const completed = await completeTask('user123', 5);
 * console.log(completed.isCompleted); // 1
 */
export const completeTask = async (uid, id) => {
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
