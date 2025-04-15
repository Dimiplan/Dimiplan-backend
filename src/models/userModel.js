const db = require("../config/db");

// User {
//   id: string,
//   name: string | null,
//   grade: number | null,
//   class: number | null,
//   email: string,
//   profile_image: string
// }

const isUserExists = async (uid) => {
  const count = await db("users").where("id", uid).count("* as count");
  return parseInt(count[0].count, 10) > 0;
};

const createUser = async (user) => {
  if (!(await isUserExists(user.id))) {
    return await db("users").insert(user);
  }
};

const getUser = async (uid) => {
  const users = await db("users").where("id", uid).select("*");
  return users[0] || null;
};

const updateUser = async (uid, user) => {
  return await db("users").where("id", uid).update(user);
};

const isRegistered = async (uid) => {
  const user = await getUser(uid);
  return user !== null && user.name !== null;
};

module.exports = {
  isUserExists,
  createUser,
  getUser,
  updateUser,
  isRegistered,
};
