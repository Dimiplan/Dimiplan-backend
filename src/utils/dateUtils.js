/**
 * 날짜 유틸리티 함수
 * MySQL과 호환되는 날짜 형식으로 변환
 */

/**
 * JavaScript Date 객체 또는 ISO 문자열을 MySQL datetime 형식으로 변환
 * @param {Date|string} date - 날짜(Date 객체 또는 ISO 문자열)
 * @returns {string} - MySQL 호환 날짜 문자열 (YYYY-MM-DD HH:MM:SS)
 */
function formatDateForMySQL(date) {
  // Date 객체 또는 ISO 문자열을 Date 객체로 변환
  const dateObj = date instanceof Date ? date : new Date(date);

  // MySQL datetime 형식으로 변환 (YYYY-MM-DD HH:MM:SS)
  return dateObj
    .toISOString()
    .replace("T", " ") // 'T' 구분자를 공백으로 교체
    .replace(/\.\d+Z$/, ""); // 밀리초와 'Z' 제거
}

/**
 * 현재 시간을 MySQL datetime 형식으로 반환
 * @returns {string} - MySQL 호환 현재 시간 문자열
 */
function getCurrentMySQLDateTime() {
  return formatDateForMySQL(new Date());
}

module.exports = {
  formatDateForMySQL,
  getCurrentMySQLDateTime,
};
