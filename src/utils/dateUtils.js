/**
 * 날짜 유틸리티 함수
 * MySQL과 호환되는 날짜 형식 변환 및 시간 관련 헬퍼 함수
 */

/**
 * JavaScript Date 객체 또는 ISO 문자열을 MySQL datetime 형식으로 변환
 * @param {Date|string} date - 날짜(Date 객체 또는 ISO 문자열)
 * @returns {string} MySQL 호환 날짜 문자열 (YYYY-MM-DD HH:MM:SS)
 */
function formatDateForMySQL(date) {
  // 입력값을 Date 객체로 변환
  const dateObj = date instanceof Date ? date : new Date(date);

  // MySQL datetime 형식으로 정밀하게 변환
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const seconds = String(dateObj.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 현재 시간을 MySQL datetime 형식으로 반환
 * @returns {string} MySQL 호환 현재 시간 문자열
 */
function getCurrentMySQLDateTime() {
  return formatDateForMySQL(new Date());
}

/**
 * 주어진 날짜의 연도 시작일 반환
 * @param {Date} [date=현재 날짜] - 기준 날짜
 * @returns {Date} 연도의 첫째 날
 */
function getYearStartDate(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1);
}

/**
 * 주어진 날짜의 연도 마지막일 반환
 * @param {Date} [date=현재 날짜] - 기준 날짜
 * @returns {Date} 연도의 마지막 날
 */
function getYearEndDate(date = new Date()) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

module.exports = {
  formatDateForMySQL, // MySQL 날짜 형식 변환
  getCurrentMySQLDateTime, // 현재 MySQL 날짜/시간
  getYearStartDate, // 연도 시작일
  getYearEndDate, // 연도 마지막일
};
