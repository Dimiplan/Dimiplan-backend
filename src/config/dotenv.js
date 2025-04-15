dotenv = require("dotenv");

const node_env = "production";
dotenv.config();
dotenv.config({ path: `.env.${node_env}` });
