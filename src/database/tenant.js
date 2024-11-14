import pg from 'pg';
import { logger } from '../utils/logger.js';
import { decrypt } from '../utils/crypto.js';

const { Pool } = pg;
const tenantPools = new Map();

export const getTenantDb = async (licenseId) => {
  if (tenantPools.has(licenseId)) {
    return tenantPools.get(licenseId);
  }

  const { rows } = await centralDb.query(
    'SELECT database_config FROM licenses WHERE id = $1',
    [licenseId]
  );

  if (!rows.length) {
    throw new Error('License not found');
  }

  const config = JSON.parse(decrypt(rows[0].database_config));
  const pool = new Pool(config);

  pool.on('error', (err) => {
    logger.error(`Unexpected error on tenant database pool ${licenseId}`, err);
  });

  tenantPools.set(licenseId, pool);
  return pool;
};