export function formatDateForMySQL(date) {
  const dateObj = date instanceof Date ? date : new Date(date);

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const seconds = String(dateObj.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function getCurrentMySQLDateTime() {
  return formatDateForMySQL(new Date());
}

export function getYearStartDate(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1);
}

export function getYearEndDate(date = new Date()) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}
