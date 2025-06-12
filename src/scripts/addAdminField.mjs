/**
 * 데이터베이스 마이그레이션: users 테이블에 isAdmin 필드 추가
 * 이 스크립트는 기존 users 테이블에 관리자 권한을 나타내는 isAdmin 필드를 추가합니다.
 */
import { db } from "../config/db.mjs";
import logger from "../utils/logger.mjs";

const addAdminField = async () => {
  try {
    // 이미 isAdmin 필드가 존재하는지 확인
    const columns = await db.raw("DESCRIBE users");
    const hasAdminField = columns[0].some(column => column.Field === 'isAdmin');
    
    if (hasAdminField) {
      logger.info("isAdmin 필드가 이미 존재합니다.");
      return;
    }

    // isAdmin 필드 추가
    await db.raw("ALTER TABLE users ADD COLUMN isAdmin TINYINT(1) NOT NULL DEFAULT 0 COMMENT '관리자 권한 (0: 일반사용자, 1: 관리자)'");
    
    logger.info("users 테이블에 isAdmin 필드가 성공적으로 추가되었습니다.");
    
    // 인덱스 추가 (관리자 조회 성능 향상)
    await db.raw("CREATE INDEX idx_users_isAdmin ON users(isAdmin)");
    logger.info("isAdmin 필드에 인덱스가 추가되었습니다.");

  } catch (error) {
    logger.error("isAdmin 필드 추가 중 오류:", error);
    throw error;
  }
};

// 스크립트 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  addAdminField()
    .then(() => {
      logger.info("마이그레이션이 완료되었습니다.");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("마이그레이션 실패:", error);
      process.exit(1);
    });
}

export default addAdminField;