import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

const { Client } = pg;

export const provisionDatabase = async (licenseId, config) => {
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres'
  });

  try {
    await client.connect();

    // Create database
    const dbName = `tenant_${licenseId}`;
    await client.query(`CREATE DATABASE ${dbName}`);

    // Connect to new database and apply migrations
    const tenantClient = new Client({
      ...config,
      database: dbName
    });

    await tenantClient.connect();
    
    const migrationsPath = path.join(process.cwd(), 'src/database/migrations/tenant');
    const files = await fs.readdir(migrationsPath);
    
    for (const file of files.sort()) {
      const migration = await fs.readFile(path.join(migrationsPath, file), 'utf8');
      await tenantClient.query(migration);
      logger.info(`Applied migration ${file} to database ${dbName}`);
    }

    await tenantClient.end();
  } catch (error) {
    logger.error(`Failed to provision database for license ${licenseId}:`, error);
    throw error;
  } finally {
    await client.end();
  }
};