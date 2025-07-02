/**
 * 단어장 모델
 * 단어장 생성, 삭제 기능을 제공하는 데이터 모델입니다
 * 현재 기본적인 CRUD 작업만 구현되어 있으며, 향후 확장 예정입니다
 *
 * @fileoverview 단어장 관리 시스템의 데이터 모델 모듈
 * @todo 단어 추가, 수정, 암호화 기능 추가 필요
 */
import db from "../config/db.mjs";
import { error as _error } from "../utils/logger.mjs";

/**
 * 새 단어장 생성
 * 지정된 이름으로 새 단어장을 생성합니다
 * 동일한 이름의 단어장이 이미 존재하는 경우 오류를 발생시킵니다
 *
 * @async
 * @function createWordList
 * @param {string} name - 단어장 이름
 * @returns {string} returns.name - 단어장 이름
 * @throws {Error} 동일 이름의 단어장이 존재하거나 데이터베이스 오류 시 예외 발생
 * @example
 * const wordList = await createWordList('영어 단어장');
 * console.log(wordList.name); // '영어 단어장'
 */
export const createWordList = async (name) => {
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
        _error("단어장 생성 오류:", error);
        throw error;
    }
};

/**
 * 단어장 삭제
 * 지정된 ID의 단어장을 삭제합니다
 * 단어장이 존재하는지 확인한 후 삭제를 수행합니다
 *
 * @async
 * @function deleteWordList
 * @param {number} id - 삭제할 단어장 ID
 * @returns {Promise<void>} 삭제 완료 시 Promise 해결
 * @throws {Error} 단어장이 존재하지 않거나 데이터베이스 오류 시 예외 발생
 * @example
 * try {
 *   await deleteWordList(1);
 *   console.log('단어장 삭제 성공');
 * } catch (error) {
 *   console.error('단어장을 찾을 수 없습니다');
 * }
 */
export const deleteWordList = async (id) => {
    try {
        // 단어장 존재 여부 확인
        const existingWordList = await db("wordLists")
            .where({ id: id })
            .first();

        if (!existingWordList) {
            throw new Error("단어장이 존재하지 않습니다");
        }

        // 단어장 삭제
        await db("wordLists").where({ id: id }).del();
    } catch (error) {
        _error("단어장 삭제 오류:", error);
        throw error;
    }
};
