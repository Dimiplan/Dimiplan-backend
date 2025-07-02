/**
 * 플래너 서비스
 * 플래너 관련 비즈니스 로직을 담당합니다
 */
import {
    createPlanner,
    deletePlanner,
    getPlannerById,
    getPlanners,
    renamePlanner,
} from "../models/planner.mjs";
import logger from "../utils/logger.mjs";

/**
 * 플래너 생성 서비스
 * @param userId
 * @param requestData
 */
export const addPlanner = async (userId, requestData) => {
    const { name, isDaily, from } = requestData;

    if (name === undefined || from === undefined) {
        throw new Error("REQUIRED_FIELDS_MISSING");
    }

    await createPlanner(userId, name, isDaily, from);
    logger.verbose(`플래너 추가 성공 - 사용자: ${userId}`);
};

/**
 * 플래너 이름 변경 서비스
 * @param userId
 * @param requestData
 */
export const updatePlannerName = async (userId, requestData) => {
    const { id, name } = requestData;

    if (!id || !name) {
        throw new Error("REQUIRED_FIELDS_MISSING");
    }

    await renamePlanner(userId, id, name);
    logger.verbose(
        `플래너 이름 변경 성공 - 사용자: ${userId}, 플래너ID: ${id}`,
    );
};

/**
 * 플래너 삭제 서비스
 * @param userId
 * @param requestData
 */
export const removePlanner = async (userId, requestData) => {
    const { id } = requestData;

    if (!id) {
        throw new Error("REQUIRED_FIELDS_MISSING");
    }

    try {
        await deletePlanner(userId, id);
        logger.verbose(`플래너 삭제 성공 - 사용자: ${userId}, 플래너ID: ${id}`);
    } catch (error) {
        if (error.message === "플래너를 찾을 수 없습니다") {
            throw new Error("PLANNER_NOT_FOUND");
        }
        throw error;
    }
};

/**
 * 플래너 정보 조회 서비스
 * @param userId
 * @param plannerId
 * @returns {Promise<object>} 플래너 정보 객체
 */
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

/**
 * 플래너 목록 조회 서비스
 * @param userId
 * @returns {Promise<Array>} 플래너 목록
 */
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
