/**
 * 데이터베이스 암호화 마이그레이션 디버그 스크립트
 *
 * 이 스크립트는 마이그레이션 문제를 진단하고 단계별로 테스트합니다.
 */
const db = require("../config/db");
const {
  hashUserId,
  encryptData,
  decryptData,
} = require("../utils/cryptoUtils");
const logger = require("../utils/logger");
require("../config/dotenv");

// 환경 변수 확인
function checkEnvironmentVariables() {
  const requiredVars = [
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASS",
    "DB_NAME",
    "CRYPTO_MASTER_KEY",
    "CRYPTO_MASTER_IV",
    "UID_SALT",
  ];

  console.log("\n=== 환경 변수 확인 ===");

  let missingVars = [];
  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
      console.log(`❌ ${varName} - 설정되지 않음`);
    } else {
      // 가려진 값으로 표시
      const maskedValue =
        process.env[varName].substring(0, 3) +
        "..." +
        (process.env[varName].length > 10
          ? process.env[varName].substring(process.env[varName].length - 3)
          : "");
      console.log(`✓ ${varName} - 설정됨 (${maskedValue})`);
    }
  });

  if (missingVars.length > 0) {
    console.log(`\n⚠️ 누락된 환경 변수가 있습니다. .env 파일에 추가하세요.`);
    return false;
  }

  return true;
}

// 데이터베이스 연결 테스트
async function testDatabaseConnection() {
  console.log("\n=== 데이터베이스 연결 테스트 ===");
  try {
    await db.raw("SELECT 1+1 AS result");
    console.log(
      `✓ 데이터베이스 연결 성공 (${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME})`,
    );
    return true;
  } catch (error) {
    console.log(`❌ 데이터베이스 연결 실패: ${error.message}`);
    console.log(`상세 정보: ${JSON.stringify(error)}`);
    return false;
  }
}

// 테이블 구조 확인
async function checkTableStructure() {
  console.log("\n=== 테이블 구조 확인 ===");

  const tables = [
    "users",
    "chat",
    "chat_rooms",
    "folders",
    "plan",
    "planner",
    "userid",
  ];

  for (const table of tables) {
    try {
      const columns = await db(table).columnInfo();
      console.log(`✓ 테이블 ${table} 확인 성공`);

      // 필수 필드 확인
      if (table === "users") {
        if (!columns.id) {
          console.log(`❌ ${table} 테이블에 'id' 필드가 없습니다.`);
        }
        if (!columns.created_at) {
          console.log(
            `⚠️ ${table} 테이블에 'created_at' 필드가 없습니다. 스키마 업데이트가 필요합니다.`,
          );
        }
      }

      if (columns.owner) {
        const ownerInfo = columns.owner;
        if (
          ownerInfo.type.toLowerCase().indexOf("varchar(128)") === -1 &&
          ownerInfo.type.toLowerCase().indexOf("char(128)") === -1 &&
          ownerInfo.type.toLowerCase().indexOf("text") === -1
        ) {
          console.log(
            `⚠️ ${table} 테이블의 'owner' 필드가 충분히 크지 않습니다. SHA3 해시를 저장하려면 VARCHAR(128) 이상이어야 합니다.`,
          );
        }
      }
    } catch (error) {
      console.log(`❌ 테이블 ${table} 확인 실패: ${error.message}`);
    }
  }
}

// 암호화 기능 테스트
function testEncryption() {
  console.log("\n=== 암호화 기능 테스트 ===");

  try {
    const testUserId = "test-user-id-123";
    const testData = "This is a test message";

    // 해싱 테스트
    const hashedId = hashUserId(testUserId);
    console.log(
      `✓ 사용자 ID 해싱 성공: ${testUserId.substring(0, 5)}... -> ${hashedId.substring(0, 10)}...`,
    );

    // 암호화 테스트
    const encryptedData = encryptData(testUserId, testData);
    console.log(
      `✓ 데이터 암호화 성공: ${testData} -> ${encryptedData.substring(0, 20)}...`,
    );

    // 복호화 테스트
    const decryptedData = decryptData(testUserId, encryptedData);
    console.log(
      `✓ 데이터 복호화 성공: ${encryptedData.substring(0, 20)}... -> ${decryptedData}`,
    );

    if (decryptedData !== testData) {
      console.log(
        `❌ 암호화/복호화 불일치! 원본: "${testData}", 복호화 결과: "${decryptedData}"`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.log(`❌ 암호화 테스트 실패: ${error.message}`);
    console.log(`상세 정보: ${error.stack}`);
    return false;
  }
}

// 사용자 데이터 샘플 확인
async function checkUsersData() {
  console.log("\n=== 사용자 데이터 확인 ===");

  try {
    const userCount = await db("users").count("* as count").first();
    console.log(`✓ 사용자 테이블에 ${userCount.count}명의 사용자가 있습니다.`);

    if (userCount.count > 0) {
      const sampleUser = await db("users").select("*").first();
      console.log(`✓ 샘플 사용자 ID: ${sampleUser.id.substring(0, 10)}...`);

      // ID가 이미 해시되어 있는지 확인
      const possiblePlainIds = ["google-id", "facebook-id", "local-id"];
      let seemsHashed = true;

      for (const prefix of possiblePlainIds) {
        if (sampleUser.id.startsWith(prefix)) {
          seemsHashed = false;
          break;
        }
      }

      // 길이가 64인 경우 이미 SHA-256/SHA3-256 해시일 가능성 있음
      if (sampleUser.id.length === 64 && /^[0-9a-f]+$/i.test(sampleUser.id)) {
        console.log(
          `⚠️ 사용자 ID가 이미 해시되어 있는 것 같습니다. 마이그레이션 전에 데이터 백업 및 검증이 필요합니다.`,
        );
      }
    }

    return true;
  } catch (error) {
    console.log(`❌ 사용자 데이터 확인 실패: ${error.message}`);
    return false;
  }
}

// 임시 테이블 생성 테스트
async function testTempTableCreation() {
  console.log("\n=== 임시 테이블 생성 테스트 ===");

  const testTableName = "test_migration_table";

  try {
    // 테이블이 이미 존재하는지 확인
    let tableExists = false;
    try {
      await db.schema.hasTable(testTableName);
      tableExists = true;
    } catch (e) {
      // 테이블이 없음, 정상
    }

    if (tableExists) {
      try {
        await db.schema.dropTable(testTableName);
        console.log(`✓ 이전 테스트 테이블 삭제 성공`);
      } catch (e) {
        console.log(`❌ 이전 테스트 테이블 삭제 실패: ${e.message}`);
      }
    }

    // 테스트 테이블 생성
    await db.schema.createTable(testTableName, (table) => {
      table.string("plain_id", 255).primary();
      table.string("hashed_id", 255);
      table.timestamp("created_at").defaultTo(db.fn.now());
    });

    console.log(`✓ 테스트 테이블 생성 성공`);

    // 테스트 데이터 삽입
    await db(testTableName).insert({
      plain_id: "test-id-123",
      hashed_id: "hashed-value-456",
    });

    console.log(`✓ 테스트 데이터 삽입 성공`);

    // 데이터 조회
    const testRow = await db(testTableName)
      .where("plain_id", "test-id-123")
      .first();
    if (!testRow) {
      console.log(`❌ 테스트 데이터 조회 실패`);
    } else {
      console.log(`✓ 테스트 데이터 조회 성공: ${JSON.stringify(testRow)}`);
    }

    // 테스트 테이블 삭제
    await db.schema.dropTable(testTableName);
    console.log(`✓ 테스트 테이블 삭제 성공`);

    return true;
  } catch (error) {
    console.log(`❌ 임시 테이블 테스트 실패: ${error.message}`);
    console.log(`상세 정보: ${error.stack}`);
    return false;
  }
}

// 마이그레이션 테스트 준비 확인
async function checkMigrationReadiness() {
  console.log("\n=== 마이그레이션 준비 상태 ===");

  // 스키마 업데이트 확인
  let hasTimestampColumns = false;
  try {
    const userColumns = await db("users").columnInfo();
    hasTimestampColumns = !!userColumns.created_at;
  } catch (e) {
    // 무시
  }

  if (!hasTimestampColumns) {
    console.log(
      `❌ 스키마 업데이트가 필요합니다. database_schema_updates.sql를 먼저 실행하세요.`,
    );
  } else {
    console.log(`✓ 스키마가 업데이트되었습니다.`);
  }

  // 백업 상기
  console.log(
    `⚠️ 중요: 마이그레이션 전에 데이터베이스 전체 백업을 수행했는지 확인하세요.`,
  );
  console.log(
    `⚠️ 백업 명령어: mysqldump -u [사용자] -p [데이터베이스] > backup_$(date +%Y%m%d).sql`,
  );
}

// 전체 테스트 실행
async function runDiagnostics() {
  console.log("==================================================");
  console.log("  Dimiplan 마이그레이션 디버그 스크립트");
  console.log("==================================================\n");

  // 환경 변수 확인
  const envOk = checkEnvironmentVariables();
  if (!envOk) {
    console.log("\n⚠️ 환경 변수 문제가 발견되었습니다. 위 내용을 확인하세요.");
  }

  // 데이터베이스 연결 테스트
  const dbOk = await testDatabaseConnection();
  if (!dbOk) {
    console.log(
      "\n❌ 데이터베이스 연결에 실패했습니다. 다른 테스트를 진행할 수 없습니다.",
    );
    process.exit(1);
  }

  // 테이블 구조 확인
  await checkTableStructure();

  // 암호화 기능 테스트
  const encryptionOk = testEncryption();
  if (!encryptionOk) {
    console.log(
      "\n❌ 암호화 기능에 문제가 있습니다. 마이그레이션을 진행할 수 없습니다.",
    );
  }

  // 사용자 데이터 확인
  await checkUsersData();

  // 임시 테이블 생성 테스트
  const tempTableOk = await testTempTableCreation();
  if (!tempTableOk) {
    console.log(
      "\n❌ 임시 테이블 생성에 실패했습니다. 데이터베이스 권한을 확인하세요.",
    );
  }

  // 마이그레이션 준비 확인
  await checkMigrationReadiness();

  console.log("\n==================================================");
  console.log("  진단 결과");
  console.log("==================================================");

  if (!envOk || !dbOk || !encryptionOk || !tempTableOk) {
    console.log(
      "\n❌ 문제가 발견되었습니다. 위 내용을 확인하고 해결한 후 다시 시도하세요.",
    );
  } else {
    console.log(
      "\n✓ 기본 테스트를 통과했습니다. 마이그레이션을 진행할 수 있습니다.",
    );
    console.log("  다음 명령을 실행하세요:");
    console.log("  1. 먼저 테스트 실행: npm run migrate:encrypt:dry");
    console.log("  2. 실제 마이그레이션 실행: npm run migrate:encrypt");
  }
}

// 진단 실행
runDiagnostics().catch((err) => {
  console.error("진단 중 오류 발생:", err);
  process.exit(1);
});
