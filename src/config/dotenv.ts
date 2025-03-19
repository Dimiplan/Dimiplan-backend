import dotenv from 'dotenv'

const node_env: NodeEnv = 'development'
dotenv.config()
dotenv.config({ path: `.env.${node_env}` })

type NodeEnv = 'development' | 'production'