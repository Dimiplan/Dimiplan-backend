/**
 * 데이터베이스 암호화 마이그레이션 스크립트
 *
 * 기존 평문 데이터를 암호화된 형태로 변환하는 작업을 수행합니다.
 * 주의: 이 스크립트는 백업 후에 실행하세요!
 */
const db = require("../config/db");
const { hashUserId, encryptData } = require("../utils/cryptoUtils");
const logger = require("../utils/logger");
require("../config/dotenv");

// 암호화할 테이블과 필드 정의
const TABLES_TO_ENCRYPT = [
  {
    name: "users",
    idField: "id",
    fieldsToEncrypt: ["name", "email", "profile_image"],
    returnPlainId: true,
  },
  {
    name: "chat",
    idField: "owner",
    fieldsToEncrypt: ["message"],
    returnPlainId: false,
  },
  {
    name: "chat_rooms",
    idField: "owner",
    fieldsToEncrypt: ["name"],
    returnPlainId: false,
  },
  {
    name: "folders",
    idField: "owner",
    fieldsToEncrypt: ["name"],
    returnPlainId: false,
  },
  {
    name: "plan",
    idField: "owner",
    fieldsToEncrypt: ["contents"],
    returnPlainId: false,
  },
  {
    name: "planner",
    idField: "owner",
    fieldsToEncrypt: ["name"],
    returnPlainId: false,
  },
  {
    name: "userid",
    idField: "owner",
    fieldsToEncrypt: [], // owner 필드만 해싱
    returnPlainId: false,
  },
];

/**
 * 사용자 ID 해싱을 위한 임시 매핑 테이블 생성
 * 평문 ID와 해시된 ID 간의 참조를 유지하기 위함
 */
async function createTempUserIdMapping() {
  try {
    // 임시 매핑 테이블 생성
    await db.schema.createTable("temp_user_id_mapping", (table) => {
      table.string("plain_id", 255).primary();
      table.string("hashed_id", 255).notNullable();
      table.timestamp("created_at").defaultTo(db.fn.now());
    });

    logger.info("Created temporary user ID mapping table");

    // 모든 사용자 가져오기
    const users = await db("users").select("id");

    // 각 사용자 ID를 해싱하여 매핑 테이블에 저장
    for (const user of users) {
      const plainId = user.id;
      const hashedId = hashUserId(plainId);

      await db("temp_user_id_mapping").insert({
        plain_id: plainId,
        hashed_id: hashedId,
      });
    }

    logger.info(`Mapped ${users.length} user IDs`);
    return true;
  } catch (error) {
    logger.error("Failed to create user ID mapping:", error);
    return false;
  }
}

/**
 * 테이블의 데이터 암호화
 * @param {Object} tableConfig - 테이블 설정 정보
 * @param {boolean} dryRun - 실제로 변경하지 않고 로그만 출력
 */
async function encryptTable(tableConfig, dryRun = false) {
  const { name, idField, fieldsToEncrypt, returnPlainId } = tableConfig;

  try {
    logger.info(`Processing table: ${name}`);

    // ID 매핑 테이블 가져오기
    const idMappings = await db("temp_user_id_mapping").select("*");
    const idMap = new Map();
    idMappings.forEach((mapping) => {
      idMap.set(mapping.plain_id, mapping.hashed_id);
    });

    // 테이블의 모든 레코드 가져오기
    const records = await db(name).select("*");
    logger.info(`Found ${records.length} records in ${name}`);

    let processedCount = 0;

    // 각 레코드 처리
    for (const record of records) {
      // 사용자 ID 확인
      const plainId = record[idField];
      if (!plainId) {
        logger.warn(`Record in ${name} has no ${idField}, skipping`);
        continue;
      }

      // 해시된 ID 가져오기
      const hashedId = idMap.get(plainId);
      if (!hashedId) {
        logger.warn(`No mapping found for ID ${plainId} in ${name}, skipping`);
        continue;
      }

      // 업데이트할 데이터 준비
      const updateData = {};

      // ID 필드 해싱
      updateData[idField] = hashedId;

      // 암호화할 필드 처리
      for (const field of fieldsToEncrypt) {
        if (record[field] !== null && record[field] !== undefined) {
          updateData[field] = encryptData(plainId, record[field]);
        }
      }

      // 타임스탬프 추가
      if (!record.created_at) {
        updateData.created_at = new Date().toISOString();
      }
      if (!record.updated_at) {
        updateData.updated_at = new Date().toISOString();
      }

      // 로그 출력
      if (dryRun) {
        logger.info(`Would update ${name} record with ID ${plainId}`);
      } else {
        // 기존 레코드를 삭제하고 암호화된 레코드 추가
        // 주의: 이 방식은 ID가 변경되기 때문에 안전한 방법입니다.
        // 참조 무결성을 유지하기 위해 FK 제약 조건은 임시로 비활성화되어 있어야 합니다.
        await db.transaction(async (trx) => {
          // 기존 레코드 삭제
          await trx(name)
            .where({ [idField]: plainId })
            .del();

          // 암호화된 레코드 추가
          if (returnPlainId) {
            // users 테이블의 경우 매핑을 위해 원본 ID 반환
            await trx(name).insert({
              ...record,
              ...updateData,
            });
          } else {
            // 다른 테이블의 경우 모든 필드 업데이트
            await trx(name).insert({
              ...record,
              ...updateData,
            });
          }
        });

        processedCount++;
        if (processedCount % 100 === 0) {
          logger.info(
            `Processed ${processedCount}/${records.length} records in ${name}`,
          );
        }
      }
    }

    logger.info(`Completed processing ${processedCount} records in ${name}`);
    return true;
  } catch (error) {
    logger.error(`Error encrypting table ${name}:`, error);
    return false;
  }
}

/**
 * 임시 매핑 테이블 삭제 (마이그레이션 완료 후)
 */
async function cleanupTempMapping() {
  try {
    await db.schema.dropTable("temp_user_id_mapping");
    logger.info("Removed temporary user ID mapping table");
    return true;
  } catch (error) {
    logger.error("Failed to remove user ID mapping table:", error);
    return false;
  }
}

/**
 * 전체 마이그레이션 실행
 */
async function runMigration(dryRun = true) {
  logger.info(`Starting encryption migration (dry run: ${dryRun})`);

  try {
    // 데이터베이스 백업 확인
    if (!dryRun) {
      const confirm = await promptConfirmation(
        "WARNING: This will encrypt all data in the database. " +
          "Make sure you have a backup before proceeding. Continue? (yes/no)",
      );

      if (!confirm) {
        logger.info("Migration cancelled by user");
        process.exit(0);
      }
    }

    // 마이그레이션 시작 시간
    const startTime = Date.now();

    // 사용자 ID 매핑 테이블 생성
    const mappingCreated = await createTempUserIdMapping();
    if (!mappingCreated) {
      throw new Error("Failed to create user ID mapping");
    }

    // 각 테이블 암호화
    for (const tableConfig of TABLES_TO_ENCRYPT) {
      const success = await encryptTable(tableConfig, dryRun);
      if (!success && !dryRun) {
        throw new Error(`Failed to encrypt table ${tableConfig.name}`);
      }
    }

    // 임시 매핑 테이블 정리
    if (!dryRun) {
      const cleanupSuccess = await cleanupTempMapping();
      if (!cleanupSuccess) {
        logger.warn("Failed to clean up temporary mapping table");
      }
    }

    // 마이그레이션 완료 시간 및 소요 시간
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    logger.info(
      `Encryption migration ${dryRun ? "(dry run) " : ""}completed in ${duration.toFixed(2)} seconds`,
    );
  } catch (error) {
    logger.error("Migration failed:", error);
    process.exit(1);
  }
}

/**
 * 사용자에게 확인 요청
 * @param {string} message - 표시할 메시지
 * @returns {Promise<boolean>} - 확인 여부
 */
function promptConfirmation(message) {
  return new Promise((resolve) => {
    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question(`${message} `, (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

// 커맨드라인 인자 처리
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("-d");

// 마이그레이션 실행
runMigration(dryRun).finally(() => {
  // 프로세스 종료
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
