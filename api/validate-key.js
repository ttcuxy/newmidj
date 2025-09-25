import OpenAI from 'openai';
    import { GoogleGenerativeAI } from '@google/generative-ai';

    /**
     * Обработчик для валидации API ключа
     * @param {import('http').IncomingMessage} req
     * @param {import('http').ServerResponse} res
     */
    export default async function handler(req, res) {
      if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        res.statusCode = 405;
        res.end(`Method ${req.method} Not Allowed`);
        return;
      }

      try {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        const { apiKey, provider } = JSON.parse(body);

        if (!apiKey || !provider) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing apiKey or provider.' }));
          return;
        }

        let isValid = false;

        if (provider.toLowerCase() === 'openai') {
          try {
            const openai = new OpenAI({ apiKey });
            // Делаем очень дешевый запрос для проверки ключа - получаем список моделей
            await openai.models.list();
            isValid = true;
          } catch (error) {
            // Если API вернуло ошибку (например, 401 Unauthorized), ключ невалиден
            isValid = false;
            console.error("OpenAI key validation failed:", error.message);
          }
        } else if (provider.toLowerCase() === 'google') {
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            // Для Gemini, можно попробовать получить модель. Это проверит ключ.
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            // И сделать самый дешевый запрос - подсчет токенов
            await model.countTokens("test");
            isValid = true;
          } catch (error) {
            isValid = false;
            console.error("Google/Gemini key validation failed:", error.message);
          }
        } else {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Unsupported provider: ${provider}` }));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ valid: isValid }));

      } catch (error) {
        console.error('Error in validate-key handler:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal server error.', details: error.message }));
      }
    }
