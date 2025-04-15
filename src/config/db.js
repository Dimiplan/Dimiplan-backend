const knex = require("knex");
require("../config/dotenv"); // Load environment variables

const options = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

const db = knex({
  client: "mysql2",
  connection: options,
});

module.exports = db;
module.exports.options = options;
