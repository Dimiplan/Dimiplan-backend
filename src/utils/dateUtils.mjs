/**
 * 날짜 유틸리티 함수
 * MySQL과 호환되는 날짜 형식 변환 및 시간 관련 헬퍼 함수를 제공합니다
 * JavaScript Date 객체를 MySQL datetime 형식으로 변환하고 연도별 날짜 계산 기능을 포함합니다
 * 
 * @fileoverview MySQL 데이터베이스와 호환되는 날짜 처리 유틸리티 모듈
 */

/**
 * JavaScript Date 객체 또는 ISO 문자열을 MySQL datetime 형식으로 변환
 * 입력값을 Date 객체로 변환한 후 MySQL에서 사용할 수 있는 datetime 형식으로 정밀하게 변환합니다
 * padStart를 사용하여 상수 자릿수를 보장합니다
 * 
 * @function formatDateForMySQL
 * @param {Date|string} date - 날짜(Date 객체 또는 ISO 문자열)
 * @returns {string} MySQL 호환 날짜 문자열 (YYYY-MM-DD HH:MM:SS 형식)
 * @example
 * // Date 객체 변환
 * const date = new Date('2023-12-25T14:30:45');
 * console.log(formatDateForMySQL(date)); // "2023-12-25 14:30:45"
 * 
 * // ISO 문자열 변환
 * console.log(formatDateForMySQL('2023-12-25T14:30:45Z')); // "2023-12-25 14:30:45"
 */
export function formatDateForMySQL(date) {
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
 * formatDateForMySQL 함수를 사용하여 현재 시간을 MySQL 호환 형식으로 변환합니다
 * 데이터베이스 레코드의 created_at, updated_at 필드에 사용할 수 있습니다
 * 
 * @function getCurrentMySQLDateTime
 * @returns {string} MySQL 호환 현재 시간 문자열 (YYYY-MM-DD HH:MM:SS 형식)
 * @example
 * const now = getCurrentMySQLDateTime();
 * console.log(now); // "2023-12-25 14:30:45"
 * 
 * // 데이터베이스 삽입 시 사용
 * await db('users').insert({
 *   name: '홍길동',
 *   created_at: getCurrentMySQLDateTime()
 * });
 */
export function getCurrentMySQLDateTime() {
  return formatDateForMySQL(new Date());
}

/**
 * 주어진 날짜의 연도 시작일 반환
 * 기준 날짜의 연도 1월 1일 00:00:00을 반환합니다
 * 연도별 데이터 필터링이나 통계 처리에 유용합니다
 * 
 * @function getYearStartDate
 * @param {Date} [date=new Date()] - 기준 날짜 (기본값: 현재 날짜)
 * @returns {Date} 연도의 첫째 날 (1월 1일 00:00:00)
 * @example
 * // 2023년의 시작일
 * const startOfYear = getYearStartDate(new Date('2023-06-15'));
 * console.log(startOfYear); // 2023-01-01 00:00:00
 * 
 * // 현재 연도의 시작일
 * const thisYearStart = getYearStartDate();
 */
export function getYearStartDate(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1);
}

/**
 * 주어진 날짜의 연도 마지막일 반환
 * 기준 날짜의 연도 12월 31일 23:59:59.999를 반환합니다
 * 연도별 데이터 필터링이나 통계 처리에 유용하며, 범위 검색에서 끝점으로 사용됩니다
 * 
 * @function getYearEndDate
 * @param {Date} [date=new Date()] - 기준 날짜 (기본값: 현재 날짜)
 * @returns {Date} 연도의 마지막 날 (12월 31일 23:59:59.999)
 * @example
 * // 2023년의 마지막일
 * const endOfYear = getYearEndDate(new Date('2023-06-15'));
 * console.log(endOfYear); // 2023-12-31 23:59:59.999
 * 
 * // 연도별 데이터 범위 검색
 * const yearStart = getYearStartDate();
 * const yearEnd = getYearEndDate();
 * const yearlyData = await db('records')
 *   .whereBetween('created_at', [yearStart, yearEnd]);
 */
export function getYearEndDate(date = new Date()) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}
