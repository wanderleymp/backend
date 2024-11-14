import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

const centralPool = new Pool({
  host: process.env.CENTRAL_DB_HOST,
  port: process.env.CENTRAL_DB_PORT,
  user: process.env.CENTRAL_DB_USER,
  password: process.env.CENTRAL_DB_PASS,
  database: process.env.CENTRAL_DB_NAME,
});

centralPool.on('error', (err) => {
  logger.error('Unexpected error on central database pool', err);
});

export const centralDb = {
  query: (text, params) => centralPool.query(text, params),
  getClient: () => centralPool.connect(),
};