import { jobs } from './jobs-cache.js';
import crypto from 'crypto';
import OpenAI from 'openai';

/**
 * Асинхронно валидирует API ключ и получает список моделей.
 * @param {string} apiKey - API ключ
 * @param {string} provider - 'openai' или 'google'
 */
async function validateAndGetModels(apiKey, provider) {
  let models = [];
  if (provider.toLowerCase() === 'openai') {
    const openai = new OpenAI({ apiKey });
    const modelsList = await openai.models.list();
    models = modelsList.data
      .filter(model => model.id.startsWith('gpt'))
      .map(model => model.id)
      .sort()
      .reverse();
  } else if (provider.toLowerCase() === 'google') {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Invalid Google API Key or API is not enabled.');
    }
    const data = await response.json();
    models = data.models
      .filter(model =>
        model.supportedGenerationMethods.includes('generateContent') &&
        model.name.includes('gemini')
      )
      .map(model => model.name.replace('models/', ''))
      .sort()
      .reverse();
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  return models;
}

/**
 * Обработчик для запуска асинхронной валидации ключа.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return {
      statusCode: 405,
      body: `Method ${req.method} Not Allowed`,
    };
  }

  try {
    if (!req.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Request body is empty or not parsed." }),
      };
    }

    // Vercel может передавать тело как строку, а Netlify - как уже готовый объект.
    // Этот код обрабатывает оба случая.
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { apiKey, provider } = data;

    if (!apiKey || !provider) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing apiKey or provider.' }),
      };
    }

    const jobId = crypto.randomUUID();
    jobs.set(jobId, { status: 'pending' });

    // Запускаем валидацию в фоне и не ждем ее завершения.
    // Сразу возвращаем jobId клиенту.
    validateAndGetModels(apiKey, provider)
      .then(models => {
        jobs.set(jobId, { status: 'success', models });
      })
      .catch(error => {
        console.error(`Validation failed for job ${jobId}:`, error);
        jobs.set(jobId, { status: 'error', message: error.message });
      });

    return {
      statusCode: 202, // Accepted
      body: JSON.stringify({ jobId }),
    };

  } catch (error) {
    console.error("Error starting validation:", error);
    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON in request body." }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", details: error.message }),
    };
  }
}
