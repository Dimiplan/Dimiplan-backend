/**
 * 관리자 데이터베이스 라우터
 * 데이터베이스 조회 및 관리 관련 라우트
 */

import { Router } from "express";
import { db } from "../../config/db.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

/**
 * @name 데이터베이스 테이블 목록 조회
 * @route {GET} /admin/database/tables
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} data[].name - 테이블명
 * @returns {number} data[].rowCount - 테이블 행 수
 */
router.get("/tables", async (req, res) => {
  try {
    const tables = await db.raw("SHOW TABLES");
    const tableList = tables[0].map((row) => Object.values(row)[0]);

    const tablesInfo = await Promise.all(
      tableList.map(async (tableName) => {
        const [count] = await db(tableName).count("* as count");
        return {
          name: tableName,
          rowCount: count.count,
        };
      }),
    );

    logger.info("데이터베이스 테이블 목록 조회", {
      admin: req.user?.email,
      tableCount: tablesInfo.length,
    });

    res.json({ success: true, data: tablesInfo });
  } catch (error) {
    logger.error("데이터베이스 테이블 목록 조회 실패", {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      message: "데이터베이스 조회 실패",
    });
  }
});

/**
 * @name 특정 테이블 데이터 조회
 * @route {GET} /admin/database/tables/:tableName
 * @routeparam {string} tableName - 테이블명
 * @queryparam {number} [page=1] - 페이지 번호
 * @queryparam {number} [limit=50] - 페이지당 항목 수
 * @returns {boolean} success - 요청 성공 여부
 * @returns {string} data.tableName - 테이블명
 * @returns {string} data.columns[].name - 컬럼명
 * @returns {string} data.columns[].type - 컬럼 타입
 * @returns {boolean} data.columns[].nullable - null 허용 여부
 * @returns {string} data.columns[].key - 키 정보
 * @returns {string} data.columns[].default - 기본값
 * @returns {Array} data.rows - 테이블 데이터
 * @returns {number} data.pagination.page - 현재 페이지
 * @returns {number} data.pagination.limit - 페이지당 항목 수
 * @returns {number} data.pagination.totalCount - 전체 항목 수
 * @returns {number} data.pagination.totalPages - 전체 페이지 수
 */
router.get("/tables/:tableName", async (req, res) => {
  try {
    const { tableName } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // 테이블 존재 확인
    const tableExists = await db.schema.hasTable(tableName);
    if (!tableExists) {
      return res
        .status(404)
        .json({ success: false, message: "테이블을 찾을 수 없습니다" });
    }

    // 전체 레코드 수 가져오기
    const [{ count: totalCount }] = await db(tableName).count("* as count");

    // 데이터 가져오기
    const data = await db(tableName).select("*").limit(limit).offset(offset);

    // 컬럼 정보 가져오기
    const columns = await db.raw(`DESCRIBE ${tableName}`);
    const columnInfo = columns[0].map((col) => ({
      name: col.Field,
      type: col.Type,
      nullable: col.Null === "YES",
      key: col.Key,
      default: col.Default,
    }));

    logger.info("테이블 데이터 조회", {
      admin: req.user?.email,
      tableName,
      page,
      limit,
      totalCount,
    });

    res.json({
      success: true,
      data: {
        tableName,
        columns: columnInfo,
        rows: data,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    logger.error("테이블 데이터 조회 실패", { error: error.message });
    res.status(500).json({
      success: false,
      message: "테이블 데이터 조회 실패",
    });
  }
});

/**
 * @name 특정 테이블 행 추가
 * @route {POST} /admin/database/tables/:tableName
 * @routeparam {string} tableName - 테이블명
 * @bodyparam {object} data - 추가할 데이터
 * @returns {boolean} success - 요청 성공 여부
 * @returns {number} data.insertId - 추가된 행의 ID
 */
router.post("/tables/:tableName", async (req, res) => {
  try {
    const { tableName } = req.params;
    const { data } = req.body;

    if (!data || typeof data !== "object") {
      return res.status(400).json({
        success: false,
        message: "데이터가 필요합니다",
      });
    }

    const tableExists = await db.schema.hasTable(tableName);
    if (!tableExists) {
      return res.status(404).json({
        success: false,
        message: "테이블을 찾을 수 없습니다",
      });
    }

    const [insertId] = await db(tableName).insert(data);

    logger.info("데이터베이스 행 추가", {
      admin: req.user?.email,
      tableName,
      insertId,
    });

    res.json({
      success: true,
      data: { insertId },
    });
  } catch (error) {
    logger.error("데이터베이스 행 추가 실패", { error: error.message });
    res.status(500).json({
      success: false,
      message: "데이터 추가 실패",
    });
  }
});

/**
 * @name 특정 테이블 행 수정
 * @route {PUT} /admin/database/tables/:tableName
 * @routeparam {string} tableName - 테이블명
 * @bodyparam {object} data - 수정할 데이터
 * @bodyparam {object} where - 조건 (키-값 쌍)
 * @returns {boolean} success - 요청 성공 여부
 * @returns {number} data.affectedRows - 수정된 행 수
 */
router.put("/tables/:tableName", async (req, res) => {
  try {
    const { tableName } = req.params;
    const { data, where } = req.body;

    if (!data || typeof data !== "object") {
      return res.status(400).json({
        success: false,
        message: "데이터가 필요합니다",
      });
    }

    if (!where || typeof where !== "object") {
      return res.status(400).json({
        success: false,
        message: "조건(where)이 필요합니다",
      });
    }

    const tableExists = await db.schema.hasTable(tableName);
    if (!tableExists) {
      return res.status(404).json({
        success: false,
        message: "테이블을 찾을 수 없습니다",
      });
    }

    let query = db(tableName);
    Object.entries(where).forEach(([key, value]) => {
      query = query.where(key, value);
    });

    const affectedRows = await query.update(data);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "수정할 데이터를 찾을 수 없습니다",
      });
    }

    logger.info("데이터베이스 행 수정", {
      admin: req.user?.email,
      tableName,
      where,
      affectedRows,
    });

    res.json({
      success: true,
      data: { affectedRows },
    });
  } catch (error) {
    logger.error("데이터베이스 행 수정 실패", { error: error.message });
    res.status(500).json({
      success: false,
      message: "데이터 수정 실패",
    });
  }
});

/**
 * @name 특정 테이블 행 삭제
 * @route {DELETE} /admin/database/tables/:tableName
 * @bodyparam {object} where - 삭제 조건 (키-값 쌍)
 * @returns {boolean} success - 요청 성공 여부
 * @returns {number} data.affectedRows - 삭제된 행 수
 */
router.delete("/tables/:tableName", async (req, res) => {
  try {
    const { tableName } = req.params;
    const { where } = req.body;

    if (!where || typeof where !== "object") {
      return res.status(400).json({
        success: false,
        message: "삭제 조건(where)이 필요합니다",
      });
    }

    const tableExists = await db.schema.hasTable(tableName);
    if (!tableExists) {
      return res.status(404).json({
        success: false,
        message: "테이블을 찾을 수 없습니다",
      });
    }

    let query = db(tableName);
    Object.entries(where).forEach(([key, value]) => {
      query = query.where(key, value);
    });

    const affectedRows = await query.del();

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "삭제할 데이터를 찾을 수 없습니다",
      });
    }

    logger.info("데이터베이스 행 삭제", {
      admin: req.user?.email,
      tableName,
      where,
      affectedRows,
    });

    res.json({
      success: true,
      data: { affectedRows },
    });
  } catch (error) {
    logger.error("데이터베이스 행 삭제 실패", { error: error.message });
    res.status(500).json({
      success: false,
      message: "데이터 삭제 실패",
    });
  }
});

export default router;
