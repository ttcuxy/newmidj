import OpenAI from 'openai';

/**
 * Асинхронно валидирует API ключ и получает список моделей с тайм-аутом.
 * @param {string} apiKey - API ключ
 * @param {string} provider - 'OpenAI' или 'Google'
 * @param {AbortSignal} signal - Сигнал для прерывания запроса
 */
async function validateAndGetModels(apiKey, provider, signal) {
  let models = [];
  if (provider === 'OpenAI') {
    const openai = new OpenAI({ apiKey });
    const modelsList = await openai.models.list({ signal });
    models = modelsList.data
      .filter(model => model.id.startsWith('gpt'))
      .map(model => model.id)
      .sort()
      .reverse();
  } else if (provider === 'Google') {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { signal });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Неверный ключ Google API или API не включен.');
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
    throw new Error(`Неподдерживаемый провайдер: ${provider}`);
  }
  return models;
}

/**
 * Обработчик для Vercel Serverless Function.
 * Валидирует ключ API синхронно с тайм-аутом 8 секунд.
 * @param {import('http').IncomingMessage} request
 * @param {import('http').ServerResponse} response
 */
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ error: `Метод ${request.method} не разрешен` });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-секундный тайм-аут

  try {
    // Vercel автоматически парсит JSON тело, если Content-Type правильный
    const { apiKey, provider } = request.body;

    if (!apiKey || !provider) {
      clearTimeout(timeoutId);
      return response.status(400).json({ error: 'Отсутствует apiKey или provider.' });
    }

    const models = await validateAndGetModels(apiKey, provider, controller.signal);
    clearTimeout(timeoutId);

    return response.status(200).json({ models });

  } catch (error) {
    clearTimeout(timeoutId);
    let errorMessage = "Произошла неизвестная ошибка.";
    if (error.name === 'AbortError') {
      errorMessage = "Проверка прервалась по тайм-ауту (8 секунд).";
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return response.status(500).json({ error: "Ошибка валидации", details: errorMessage });
  }
}
