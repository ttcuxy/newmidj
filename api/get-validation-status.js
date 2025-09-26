import { jobs } from './jobs-cache.js';
import { URL } from 'url';

/**
 * Обработчик для получения статуса задачи валидации.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return {
      statusCode: 405,
      body: `Method ${req.method} Not Allowed`,
    };
  }

  try {
    // req.url содержит только путь и query string, для парсинга нужен полный URL
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const jobId = requestUrl.searchParams.get('jobId');

    if (!jobId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing jobId parameter.' }),
      };
    }

    const job = jobs.get(jobId);

    if (!job) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Job not found.' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(job),
    };

  } catch (error) {
    console.error("Error getting validation status:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", details: error.message }),
    };
  }
}
