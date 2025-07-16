import { Router } from "express";
import { db } from "../../config/db.mjs";
import logger from "../../utils/logger.mjs";

const router = Router();

/**
 * @name 사용자 통계 정보 조회
 * @route {GET} /admin/stats/users
 * @returns {boolean} success - 요청 성공 여부
 * @returns {number} data.totalUsers - 전체 사용자 수
 * @returns {number} data.activeUsers - 최근 30일 활성 사용자 수
 * @returns {string} data.recentUsers[].id - 사용자 ID
 * @returns {string} data.recentUsers[].email - 사용자 이메일
 * @returns {string} data.recentUsers[].created_at - 가입 날짜
 */
router.get("/users", async (req, res) => {
  try {
    const [totalUsers] = await db("users").count("* as count");
    const [activeUsers] = await db("users")
      .where("created_at", ">", db.raw("DATE_SUB(NOW(), INTERVAL 30 DAY)"))
      .count("* as count");

    const recentUsers = await db("users")
      .select("id", "email", "created_at")
      .orderBy("created_at", "desc")
      .limit(10);

    const stats = {
      totalUsers: totalUsers.count,
      activeUsers: activeUsers.count,
      recentUsers,
    };

    logger.info("사용자 통계 조회", { admin: req.user?.email });
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error("사용자 통계 조회 실패", { error: error.message });
    res.status(500).json({
      success: false,
      message: "사용자 통계 조회 실패",
    });
  }
});

export default router;
