/**
 * 관리자 인증 미들웨어
 * 관리자 권한이 있는 사용자만 특정 라우트에 접근할 수 있도록 제한
 */

import { db } from "../config/db.mjs";
import { hashUserId } from "../utils/crypto.mjs";
import logger from "../utils/logger.mjs";

/**
 * 관리자 권한 검증 미들웨어
 * 사용자가 로그인되어 있고 isAdmin이 1인지 확인합니다
 *
 * @param {object} req - Express 요청 객체
 * @param {string} req.user.id - 사용자 ID
 * @param {string} req.ip - 클라이언트 IP 주소
 * @param {object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 * @returns {Promise<void>} 권한 검증 결과에 따라 next() 호출 또는 응답 반환
 * @example
 * // 라우터에서 사용
 * router.get('/admin', isAdmin, (req, res) => {
 *   res.json({ message: '관리자 페이지' });
 * });
 */
export const isAdmin = async (req, res, next) => {
  try {
    // 사용자가 로그인되어 있는지 확인
    if (!req.user || !req.user.id) {
      logger.warn("관리자 페이지 접근 시도 - 인증되지 않은 사용자", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      return res.status(401).json({
        success: false,
        message: "인증이 필요합니다",
      });
    }

    // 사용자의 관리자 권한 확인
    const hashedUid = hashUserId(req.user.id);
    const adminCheck = await db("users")
      .where("id", hashedUid)
      .select("isAdmin")
      .first();

    if (!adminCheck || adminCheck.isAdmin !== 1) {
      logger.warn("관리자 페이지 접근 시도 - 권한 없음", {
        userId: req.user.id,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      return res.status(403).json({
        success: false,
        message: "관리자 권한이 필요합니다",
      });
    }

    // 관리자 권한 확인됨
    logger.info("관리자 페이지 접근", {
      adminId: req.user.id,
      ip: req.ip,
    });

    next();
  } catch (error) {
    logger.error("관리자 권한 검증 중 오류:", error);
    res.status(500).json({
      success: false,
      message: "권한 검증 중 오류가 발생했습니다",
    });
  }
};

/**
 * 특정 사용자를 관리자로 설정
 * 사용자 ID로 해당 사용자의 isAdmin 필드를 1로 설정합니다
 *
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>} 성공 여부
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * // 사용자를 관리자로 설정
 * const success = await setAdminUser('user123');
 * console.log(success); // true or false
 */
export const setAdminUser = async (userId) => {
  try {
    const hashedUid = hashUserId(userId);
    const result = await db("users").where("id", hashedUid).update({
      isAdmin: 1,
      updated_at: new Date(),
    });

    if (result > 0) {
      logger.info("사용자를 관리자로 설정함", { userId });
      return true;
    } else {
      logger.warn("사용자를 찾을 수 없어 관리자로 설정할 수 없음", {
        userId,
      });
      return false;
    }
  } catch (error) {
    logger.error("관리자 설정 중 오류:", error);
    throw error;
  }
};

/**
 * 사용자의 관리자 권한 제거
 * 사용자 ID로 해당 사용자의 isAdmin 필드를 0으로 설정합니다
 *
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>} 성공 여부
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * // 사용자의 관리자 권한 제거
 * const success = await removeAdminUser('user123');
 * console.log(success); // true or false
 */
export const removeAdminUser = async (userId) => {
  try {
    const hashedUid = hashUserId(userId);
    const result = await db("users").where("id", hashedUid).update({
      isAdmin: 0,
      updated_at: new Date(),
    });

    if (result > 0) {
      logger.info("사용자의 관리자 권한 제거함", { userId });
      return true;
    } else {
      logger.warn("사용자를 찾을 수 없어 관리자 권한을 제거할 수 없음", {
        userId,
      });
      return false;
    }
  } catch (error) {
    logger.error("관리자 권한 제거 중 오류:", error);
    throw error;
  }
};

/**
 * 사용자의 관리자 권한 확인
 * 사용자 ID로 해당 사용자가 관리자인지 확인합니다
 *
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>} 관리자 여부 (true: 관리자, false: 일반 사용자)
 * @throws {Error} 데이터베이스 오류 시 예외 발생
 * @example
 * // 사용자의 관리자 권한 확인
 * const isAdminUser = await checkAdminStatus('user123');
 * console.log(isAdminUser); // true or false
 */
export const checkAdminStatus = async (userId) => {
  try {
    const hashedUid = hashUserId(userId);
    const adminCheck = await db("users")
      .where("id", hashedUid)
      .select("isAdmin")
      .first();

    return adminCheck && adminCheck.isAdmin === 1;
  } catch (error) {
    logger.error("관리자 상태 확인 중 오류:", error);
    throw error;
  }
};
