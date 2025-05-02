/**
 * 개선된 데이터베이스 암호화 마이그레이션 스크립트
 *
 * 기존 평문 데이터를 암호화된 형태로 변환하는 작업을 안전하게 수행합니다.
 * 주의: 이 스크립트는 백업 후에 실행하세요!
 */
const db = require("../config/db");
const { hashUserId, encryptData } = require("../utils/cryptoUtils");
const logger = require("../utils/logger");
require("../config/dotenv");

// 컬러 로깅 도우미 함수
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

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
 * 데이터베이스 연결 및 필요한 환경 변수 확인
 */
async function checkPrerequisites() {
  colorLog("blue", "데이터베이스 연결 및 필수 요구 사항 확인 중...");

  // 환경 변수 확인
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

  const missingVars = [];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    colorLog(
      "red",
      `필수 환경 변수가 설정되지 않았습니다: ${missingVars.join(", ")}`,
    );
    return false;
  }

  // 데이터베이스 연결 테스트
  try {
    await db.raw("SELECT 1 as test");
    colorLog("green", "데이터베이스 연결 성공!");
  } catch (error) {
    colorLog("red", `데이터베이스 연결 실패: ${error.message}`);
    return false;
  }

  // 스키마 확인 - created_at 필드가 있는지 확인
  try {
    const hasUpdatedSchema = await db.schema.hasColumn("users", "created_at");
    if (!hasUpdatedSchema) {
      colorLog(
        "red",
        "users 테이블에 created_at 필드가 없습니다. 먼저 스키마 업데이트를 실행하세요.",
      );
      colorLog(
        "yellow",
        "실행 필요: mysql -u [사용자명] -p dimiplan < database_schema_updates.sql",
      );
      return false;
    }
  } catch (error) {
    colorLog("red", `스키마 확인 중 오류 발생: ${error.message}`);
    return false;
  }

  return true;
}

/**
 * 사용자 ID 해싱을 위한 임시 매핑 테이블 생성
 * 평문 ID와 해시된 ID 간의 참조를 유지하기 위함
 */
async function createTempUserIdMapping() {
  try {
    colorLog("blue", "사용자 ID 매핑 테이블 생성 중...");

    // 이전 매핑 테이블이 있으면 제거
    if (await db.schema.hasTable("temp_user_id_mapping")) {
      colorLog("yellow", "이전 임시 매핑 테이블이 발견되었습니다. 제거 중...");
      await db.schema.dropTable("temp_user_id_mapping");
    }

    // 임시 매핑 테이블 생성
    await db.schema.createTable("temp_user_id_mapping", (table) => {
      table.string("plain_id", 255).primary();
      table.string("hashed_id", 255).notNullable();
      table.timestamp("created_at").defaultTo(db.fn.now());
    });

    colorLog("green", "임시 사용자 ID 매핑 테이블 생성됨");

    // 모든 사용자 가져오기
    const users = await db("users").select("id");

    if (users.length === 0) {
      colorLog(
        "yellow",
        "사용자가 없습니다. 마이그레이션을 진행할 수 없습니다.",
      );
      return false;
    }

    colorLog("blue", `${users.length}명의 사용자 ID 매핑 중...`);

    // 각 사용자 ID를 해싱하여 매핑 테이블에 저장
    for (const user of users) {
      const plainId = user.id;
      // ID가 이미 해시된 형태인지 확인
      if (plainId.length === 64 && /^[0-9a-f]+$/i.test(plainId)) {
        colorLog(
          "yellow",
          `ID가 이미 해시된 것 같습니다: ${plainId.substring(0, 10)}...`,
        );
        continue;
      }

      const hashedId = hashUserId(plainId);

      await db("temp_user_id_mapping").insert({
        plain_id: plainId,
        hashed_id: hashedId,
      });
    }

    // 매핑 결과 확인
    const mappings = await db("temp_user_id_mapping")
      .count("* as count")
      .first();
    colorLog("green", `${mappings.count}개의 사용자 ID 매핑 완료`);

    if (mappings.count === 0) {
      colorLog(
        "red",
        "매핑된 사용자 ID가 없습니다. 마이그레이션을 진행할 수 없습니다.",
      );
      return false;
    }

    return true;
  } catch (error) {
    colorLog("red", `사용자 ID 매핑 생성 실패: ${error.message}`);
    console.error(error);
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
    colorLog("blue", `테이블 처리 중: ${name}`);

    // ID 매핑 테이블 가져오기
    const idMappings = await db("temp_user_id_mapping").select("*");
    if (idMappings.length === 0) {
      colorLog("red", "사용자 ID 매핑 테이블이 비어 있습니다.");
      return false;
    }

    const idMap = new Map();
    idMappings.forEach((mapping) => {
      idMap.set(mapping.plain_id, mapping.hashed_id);
    });

    // 테이블 존재 확인
    const tableExists = await db.schema.hasTable(name);
    if (!tableExists) {
      colorLog("yellow", `테이블 ${name}이(가) 존재하지 않습니다. 건너뜁니다.`);
      return true;
    }

    // 테이블의 모든 레코드 가져오기
    const records = await db(name).select("*");
    colorLog(
      "blue",
      `${name} 테이블에서 ${records.length}개의 레코드를 찾았습니다.`,
    );

    if (records.length === 0) {
      colorLog("yellow", `${name} 테이블에 레코드가 없습니다. 건너뜁니다.`);
      return true;
    }

    // 필드 존재 확인
    const columns = await db(name).columnInfo();
    if (!columns[idField]) {
      colorLog("red", `${name} 테이블에 ${idField} 필드가 없습니다.`);
      return false;
    }

    for (const field of fieldsToEncrypt) {
      if (!columns[field]) {
        colorLog(
          "yellow",
          `${name} 테이블에 ${field} 필드가 없습니다. 이 필드는 건너뜁니다.`,
        );
      }
    }

    // 백업 테이블 생성 (실제 마이그레이션에만)
    if (!dryRun) {
      const backupTableName = `${name}_backup_${Math.floor(Date.now() / 1000)}`;
      colorLog("blue", `${name} 테이블 백업 생성 중: ${backupTableName}`);

      // CREATE TABLE AS SELECT로 구조와 데이터 복사
      await db.raw(`CREATE TABLE ${backupTableName} LIKE ${name}`);
      await db.raw(`INSERT INTO ${backupTableName} SELECT * FROM ${name}`);

      colorLog("green", `${name} 테이블 백업 완료`);
    }

    let processedCount = 0;
    let errorCount = 0;

    // 각 레코드 처리
    for (const record of records) {
      try {
        // 사용자 ID 확인
        const plainId = record[idField];
        if (!plainId) {
          colorLog(
            "yellow",
            `${name} 테이블의 레코드에 ${idField} 값이 없습니다. 건너뜁니다.`,
          );
          continue;
        }

        // ID가 이미 해시된 형태인지 확인
        if (plainId.length === 64 && /^[0-9a-f]+$/i.test(plainId)) {
          colorLog(
            "yellow",
            `${name} 테이블의 레코드에 ${idField}가 이미 해시된 것 같습니다: ${plainId.substring(0, 10)}...`,
          );
          continue;
        }

        // 해시된 ID 가져오기
        const hashedId = idMap.get(plainId);
        if (!hashedId) {
          colorLog(
            "yellow",
            `${name} 테이블의 ID ${plainId}에 대한 매핑을 찾을 수 없습니다. 건너뜁니다.`,
          );
          continue;
        }

        // 업데이트할 데이터 준비
        const updateData = {};

        // ID 필드 해싱
        updateData[idField] = hashedId;

        // 암호화할 필드 처리
        for (const field of fieldsToEncrypt) {
          if (
            record[field] !== null &&
            record[field] !== undefined &&
            columns[field]
          ) {
            updateData[field] = encryptData(plainId, record[field]);
          }
        }

        // 타임스탬프 추가
        if (columns["created_at"] && !record.created_at) {
          updateData.created_at = new Date().toISOString();
        }
        if (columns["updated_at"] && !record.updated_at) {
          updateData.updated_at = new Date().toISOString();
        }

        // 로그 출력 또는 데이터 업데이트
        if (dryRun) {
          if (processedCount < 5) {
            // 로그 양 제한을 위해 처음 5개만 상세 출력
            colorLog(
              "blue",
              `${name} 테이블의 ID ${plainId}를 ${hashedId.substring(0, 10)}...로 업데이트합니다.`,
            );
          }
        } else {
          // 안전하게 업데이트: 먼저 삭제 후 새 데이터 삽입
          await db.transaction(async (trx) => {
            // 기존 레코드 삭제
            await trx(name)
              .where({ [idField]: plainId })
              .del();

            // 암호화된 레코드 추가
            const insertData = { ...record, ...updateData };
            await trx(name).insert(insertData);
          });
        }

        processedCount++;
        if (processedCount % 100 === 0) {
          colorLog(
            "green",
            `${name} 테이블에서 ${processedCount}/${records.length} 레코드 처리됨`,
          );
        }
      } catch (error) {
        errorCount++;
        colorLog(
          "red",
          `${name} 테이블의 레코드 처리 중 오류 발생: ${error.message}`,
        );

        if (errorCount > 10) {
          colorLog("red", "오류가 너무 많습니다. 마이그레이션을 중단합니다.");
          return false;
        }
      }
    }

    colorLog(
      "green",
      `${name} 테이블 처리 완료: ${processedCount}개의 레코드 처리됨, ${errorCount}개의 오류 발생`,
    );
    return true;
  } catch (error) {
    colorLog("red", `${name} 테이블 암호화 중 오류 발생: ${error.message}`);
    console.error(error);
    return false;
  }
}

/**
 * 임시 매핑 테이블 삭제 (마이그레이션 완료 후)
 */
async function cleanupTempMapping() {
  try {
    colorLog("blue", "임시 사용자 ID 매핑 테이블 삭제 중...");

    if (await db.schema.hasTable("temp_user_id_mapping")) {
      await db.schema.dropTable("temp_user_id_mapping");
      colorLog("green", "임시 사용자 ID 매핑 테이블 삭제됨");
    } else {
      colorLog("yellow", "임시 사용자 ID 매핑 테이블이 존재하지 않습니다.");
    }

    return true;
  } catch (error) {
    colorLog("red", `사용자 ID 매핑 테이블 삭제 실패: ${error.message}`);
    console.error(error);
    return false;
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

    readline.question(
      `${colors.bright}${colors.yellow}${message}${colors.reset} `,
      (answer) => {
        readline.close();
        resolve(answer.toLowerCase() === "yes");
      },
    );
  });
}

/**
 * 전체 마이그레이션 실행
 */
async function runMigration(dryRun = true) {
  colorLog("magenta", "=".repeat(80));
  colorLog(
    "magenta",
    `    데이터베이스 암호화 마이그레이션 ${dryRun ? "(테스트 실행)" : "(실제 실행)"}`,
  );
  colorLog("magenta", "=".repeat(80));

  try {
    // 사전 요구 사항 확인
    const prerequisitesOk = await checkPrerequisites();
    if (!prerequisitesOk) {
      colorLog(
        "red",
        "사전 요구 사항을 만족하지 않습니다. 마이그레이션을 중단합니다.",
      );
      return;
    }

    // 데이터베이스 백업 확인
    if (!dryRun) {
      colorLog(
        "yellow",
        "경고: 이 작업은 데이터베이스의 모든 데이터를 암호화합니다.",
      );
      colorLog("yellow", "데이터베이스 백업을 생성했는지 확인하세요.");
      colorLog(
        "yellow",
        "예시 명령어: mysqldump -u [사용자명] -p dimiplan > dimiplan_backup_$(date +%Y%m%d).sql",
      );

      const confirm = await promptConfirmation(
        "데이터베이스를 백업했으며 계속 진행하시겠습니까? (yes/no): ",
      );

      if (!confirm) {
        colorLog("yellow", "마이그레이션이 사용자에 의해 취소되었습니다.");
        return;
      }
    }

    // 마이그레이션 시작 시간
    const startTime = Date.now();

    // 사용자 ID 매핑 테이블 생성
    const mappingCreated = await createTempUserIdMapping();
    if (!mappingCreated) {
      colorLog(
        "red",
        "사용자 ID 매핑 생성에 실패했습니다. 마이그레이션을 중단합니다.",
      );
      return;
    }

    // 각 테이블 암호화
    let allSuccess = true;
    for (const tableConfig of TABLES_TO_ENCRYPT) {
      const success = await encryptTable(tableConfig, dryRun);
      if (!success) {
        colorLog("red", `${tableConfig.name} 테이블 암호화에 실패했습니다.`);
        allSuccess = false;

        if (!dryRun) {
          const continueConfirm = await promptConfirmation(
            `${tableConfig.name} 테이블 처리에 실패했습니다. 계속 진행하시겠습니까? (yes/no): `,
          );

          if (!continueConfirm) {
            colorLog("yellow", "마이그레이션이 사용자에 의해 중단되었습니다.");
            break;
          }
        }
      }
    }

    // 임시 매핑 테이블 정리
    if (!dryRun && allSuccess) {
      const cleanupSuccess = await cleanupTempMapping();
      if (!cleanupSuccess) {
        colorLog(
          "yellow",
          "임시 매핑 테이블 정리에 실패했습니다. 수동으로 삭제가 필요할 수 있습니다.",
        );
      }
    }

    // 마이그레이션 완료 시간 및 소요 시간
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    if (allSuccess) {
      colorLog("green", "=".repeat(80));
      colorLog(
        "green",
        `암호화 마이그레이션 ${dryRun ? "(테스트 실행)" : ""} 완료!`,
      );
      colorLog("green", `소요 시간: ${duration.toFixed(2)}초`);
      colorLog("green", "=".repeat(80));

      if (dryRun) {
        colorLog(
          "blue",
          "테스트 실행이 완료되었습니다. 모든 검증이 통과되었습니다.",
        );
        colorLog(
          "blue",
          "실제 마이그레이션을 실행하려면 다음 명령을 실행하세요:",
        );
        colorLog("blue", "  npm run migrate:encrypt");
      }
    } else {
      colorLog("yellow", "=".repeat(80));
      colorLog(
        "yellow",
        `암호화 마이그레이션 ${dryRun ? "(테스트 실행)" : ""} 부분적으로 완료됨`,
      );
      colorLog("yellow", `소요 시간: ${duration.toFixed(2)}초`);
      colorLog(
        "yellow",
        "일부 테이블 처리에 실패했습니다. 로그를 확인하고 문제를 해결하세요.",
      );
      colorLog("yellow", "=".repeat(80));
    }
  } catch (error) {
    colorLog("red", "=".repeat(80));
    colorLog("red", "마이그레이션 중 예기치 않은 오류 발생:");
    console.error(error);
    colorLog("red", "=".repeat(80));
  }
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
