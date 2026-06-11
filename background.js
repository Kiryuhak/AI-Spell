import { MISTRAL_API_KEY } from './config.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "callGemini") {
    processText(request.text, request.mode, request.targetLang)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; 
  }
});

async function processText(textToFix, mode, targetLang) {
    let systemPrompt = "";
    let temperature = 0.1;
    
    // В Mistral для работы response_format обязательно слово "JSON" в промпте
    const baseJsonInstruction = 'ОБЯЗАТЕЛЬНО верни валидный JSON-объект строго в таком формате: { "options": [{"clean": "чистый текст", "html": "текст"}] }. Никакого лишнего текста, markdown-блоков или пояснений.';

    if (mode === "spellcheck") {
        temperature = 0.0;
        systemPrompt = `Ты профессиональный русский корректор. Твоя задача — исправить грамматические, орфографические и пунктуационные ошибки в тексте пользователя.
ПРАВИЛА:
1. В поле "html" оберни исправленные слова в тег <mark>.
2. КРИТИЧЕСКИ ВАЖНО: Оборачивай в тег <mark> ВСЁ СЛОВО ЦЕЛИКОМ! Категорически запрещено оборачивать отдельные буквы, слоги или части слова.
❌ КАК НЕЛЬЗЯ ДЕЛАТЬ: Пишу код для пров<mark>ер</mark>ки.
✅ КАК ПРАВИЛЬНО: Пишу код для <mark>проверки</mark>.
3. Если слово изначально правильное, вообще не трогай его.
${baseJsonInstruction}`;
    } else if (mode === "emoji") {
        temperature = 0.6;
        systemPrompt = `Добавь подходящие по смыслу эмодзи в текст пользователя. ${baseJsonInstruction}`;
    } else if (mode === "rephrase") {
        temperature = 0.5;
        systemPrompt = `Ты профессиональный русский писатель и редактор. Твоя задача — перефразировать текст пользователя, сохранив смысл, но сделав его более красивым и читаемым.
ПРАВИЛА:
1. Сделай 2 абсолютно разных варианта (добавь их в массив options).
Вариант 1: Более живой, современный и разговорный.
Вариант 2: Лаконичный, строгий и четкий.
2. КРИТИЧЕСКИ ВАЖНО: Текст должен быть грамматически безупречным на русском языке. Следи за падежами и окончаниями.
${baseJsonInstruction}`;
    } else if (mode === "style") {
        temperature = 0.3;
        systemPrompt = `Улучши стиль текста пользователя, сделай его профессиональным и деловым. Сделай 2 варианта. ${baseJsonInstruction}`;
    } else if (mode === "translate") {
        temperature = 0.1;
        systemPrompt = `You are a professional translator. Translate the user's text into the following language: ${targetLang || "English"}.
CRITICAL: The translated text MUST be completely in the target language.
You must return a valid JSON object strictly in this format: { "options": [{"clean": "translation result", "html": "translation result"}] }.
Do not add any markdown, explanations, or extra text.`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${MISTRAL_API_KEY}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "mistral-large-latest", // Самая умная модель Mistral
            temperature: temperature,
            max_tokens: 1024,
            response_format: { type: "json_object" }, // Форсируем JSON
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: textToFix }
            ]
          })
        });

        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errMsg = errorData.message || response.statusText;
            throw new Error(`Ошибка Mistral: ${errMsg}`);
        }

        const data = await response.json();
        const rawText = data.choices[0].message.content.trim();
        const parsedJson = JSON.parse(rawText);
        
        let result = parsedJson.options;
        if (!result || !Array.isArray(result)) {
            const firstKey = Object.keys(parsedJson)[0];
            result = parsedJson[firstKey];
        }
        
        if (!Array.isArray(result)) {
            result = [parsedJson];
        }

        return result;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error("Таймаут сервера Mistral. Слишком долгое ожидание.");
        }
        throw error;
    }
}