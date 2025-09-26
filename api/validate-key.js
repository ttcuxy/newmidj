import OpenAI from 'openai';

    /**
     * Обработчик для получения списка моделей на основе API ключа
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
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        const { apiKey, provider } = JSON.parse(body);

        if (!apiKey || !provider) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing apiKey or provider.' }),
          };
        }

        let models = [];

        if (provider.toLowerCase() === 'openai') {
          const openai = new OpenAI({ apiKey });
          const modelsList = await openai.models.list();
          // Фильтруем и оставляем только gpt модели, чтобы не было лишнего
          models = modelsList.data
            .filter(model => model.id.startsWith('gpt'))
            .map(model => model.id)
            .sort()
            .reverse();

        } else if (provider.toLowerCase() === 'google') {
          // Для Google Gemini API используем REST API для получения списка моделей,
          // так как SDK не предоставляет прямого метода listModels()
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Invalid Google API Key or API is not enabled.');
          }

          const data = await response.json();
          // Фильтруем модели, которые поддерживают генерацию контента и являются "tuned" (основными)
          models = data.models
            .filter(model =>
              model.supportedGenerationMethods.includes('generateContent') &&
              model.name.includes('gemini') // Убедимся, что это Gemini модель
            )
            .map(model => model.name.replace('models/', '')) // Убираем префикс 'models/'
            .sort()
            .reverse();

        } else {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: `Unsupported provider: ${provider}` }),
          };
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ models }),
        };

      } catch (error) {
        console.error("Error during key validation:", error);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Internal Server Error", details: error.message }),
        };
      }
    }
