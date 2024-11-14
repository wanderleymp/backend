import { centralDb } from '../database/central.js';
import { encrypt } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';
import { notifyN8N } from '../services/n8nService.js';
import { provisionDatabase } from '../services/databaseService.js';

export const requestLicense = async (req, res) => {
  const { type, companyName, documentNumber } = req.body;
  const userId = req.user.id;

  const result = await centralDb.query(
    `INSERT INTO licenses (user_id, type, status, company_name, document_number)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [userId, type, 'PENDING', companyName, documentNumber]
  );

  await notifyN8N('license-request', {
    licenseId: result.rows[0].id,
    type,
    companyName,
    documentNumber
  });

  logger.info(`License requested: ${result.rows[0].id}`);
  res.status(201).json({ licenseId: result.rows[0].id });
};

export const approveLicense = async (req, res) => {
  const { licenseId } = req.params;
  const { dbConfig } = req.body;
  const adminId = req.user.id;

  const encryptedConfig = encrypt(JSON.stringify(dbConfig));
  
  await centralDb.query(
    `UPDATE licenses 
     SET status = $1, database_config = $2, approved_at = CURRENT_TIMESTAMP, approved_by = $3
     WHERE id = $4`,
    ['APPROVED', encryptedConfig, adminId, licenseId]
  );

  await provisionDatabase(licenseId, dbConfig);

  logger.info(`License approved: ${licenseId}`);
  res.status(200).json({ message: 'License approved and database provisioned' });
};