import { logger } from '../utils/logger.js';

export const notifyN8N = async (event, data) => {
  try {
    const response = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event,
        data,
      }),
    });

    if (!response.ok) {
      throw new Error(`N8N webhook failed: ${response.statusText}`);
    }

    logger.info(`N8N webhook triggered for event: ${event}`);
  } catch (error) {
    logger.error('Failed to notify N8N:', error);
    throw error;
  }
};