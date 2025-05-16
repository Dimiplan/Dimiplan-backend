import { config } from "dotenv";

const node_env = "production";
config();
config({ path: `.env.${node_env}` });
