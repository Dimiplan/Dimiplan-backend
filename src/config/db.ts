import knex from 'knex'
import '@/config/dotenv'

export const options = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT!),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
}
const db = knex({
  client: 'mysql2',
  connection: options
})

export default db