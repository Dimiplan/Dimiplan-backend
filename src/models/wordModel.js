const db = require("../config/db");
const { getNextId, executeTransaction } = require("../utils/dbUtils");
const {
  hashUserId,
  encryptData,
  decryptData,
  getTimestamp,
} = require("../utils/cryptoUtils");
const logger = require("../utils/logger");

/**
 * 새 wordList 생성
 * @param {int} id - 단어장 ID
 * @param {int} wordId - 단어장 별 단어 ID
 * @param {string} name - 단어장 이름
 * @returns {Promise<Object>} - 생성된 단어장 데이터
 */

const createWordList = async (name) => {
  try {
    // 같은 이름의 단어장 존재 여부 확인
    const existingWordList = await db("wordLists")
      .where({ name: name })
      .first();

    if (existingWordList) {
      throw new Error("동일 이름의 단어장이 존재합니다");
    }

    // 단어장 생성
    await db("wordLists").insert({ name: name });

    return { name: name };
  } catch (error) {
    logger.error("단어장 생성 오류:", error);
    throw error;
  }
};

const deleteWordList = async (id) => {
  try {
    // 단어장 존재 여부 확인
    const existingWordList = await db("wordLists").where({ id: id }).first();

    if (!existingWordList) {
      throw new Error("단어장이 존재하지 않습니다");
    }

    // 단어장 삭제
    await db("wordLists").where({ id: id }).del();
  } catch (error) {
    logger.error("단어장 삭제 오류:", error);
    throw error;
  }
};

module.exports = {
  createWordList,
  deleteWordList,
};
