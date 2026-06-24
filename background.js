chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        chrome.runtime.openOptionsPage();
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "callGemini") {
    processText(request.text, request.mode, request.targetLang)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; 
  } 
  else if (request.action === "openHistory") {
    chrome.tabs.create({ url: chrome.runtime.getURL("history.html") });
    return true;
  }
});

async function getApiKeyAndTone() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['mistralApiKey', 'selectedTone'], (result) => {
            resolve({
                apiKey: result.mistralApiKey,
                tone: result.selectedTone || 'business'
            });
        });
    });
}

async function saveToHistory(originalText, resultText, mode, explanation = null) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['aiHistory'], (res) => {
            let history = res.aiHistory || [];
            const now = Date.now();
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

            history = history.filter(item => (now - item.timestamp) < sevenDaysMs);

            history.unshift({
                id: now,
                timestamp: now,
                original: originalText,
                result: resultText,
                mode: mode,
                explanation: explanation
            });

            if (history.length > 100) {
                history = history.slice(0, 100);
            }

            chrome.storage.local.set({ aiHistory: history }, resolve);
        });
    });
}

async function processText(textToFix, mode, targetLang) {
    const config = await getApiKeyAndTone();
    
    if (!config.apiKey) {
        throw new Error("API ключ не настроен! Откройте Настройки расширения.");
    }

    let systemPrompt = "";
    let temperature = 0.1;
    
    let baseJsonInstruction = 'ОБЯЗАТЕЛЬНО верни валидный JSON-объект строго в таком формате: { "options": [{"clean": "чистый текст", "html": "текст"}] }. Никакого лишнего текста, markdown-блоков или пояснений.';

    if (mode === "spellcheck") {
        temperature = 0.0;
        systemPrompt = `Ты профессиональный русский корректор. Исправь ошибки в тексте пользователя.
ПРАВИЛА:
1. В поле "html" верни исправленный текст, где каждое измененное слово обернуто в тег <mark>.
2. СТРОЖАЙШИЙ ЗАПРЕТ: Никогда не ставь тег <mark> внутри слова! Оборачивай всё слово целиком от пробела до пробела.
❌ КАК НЕЛЬЗЯ: Пишу <mark>у</mark> код для пров<mark>ер</mark>ки
✅ КАК ПРАВИЛЬНО: <mark>Пишу</mark> код для <mark>проверки</mark>
3. В поле "explanation" напиши ПРОСТОЙ ТЕКСТ (без JSON). Кратко перечисли ошибки списком (используй • и \\n).
ОБЯЗАТЕЛЬНО верни валидный JSON-объект строго в таком формате: { "options": [{"clean": "чистый текст", "html": "текст"}], "explanation": "текст объяснения" }.`;
    } else if (mode === "emoji") {
        temperature = 0.6;
        systemPrompt = `Добавь подходящие по смыслу эмодзи в текст пользователя. ${baseJsonInstruction}`;
    } else if (mode === "style") {
        temperature = 0.4;
        let toneInstruction = "";
        
        if (config.tone === "friendly") {
            toneInstruction = "Ты теплый, дружелюбный и открытый собеседник. Твоя задача — переписать текст пользователя, сделав его живым, приветливым, неформальным и легким для чтения, сохранив при этом исходный смысл. Избегай сухости.";
        } else if (config.tone === "persuasive") {
            toneInstruction = "Ты профессиональный копирайтер и мастер убеждения. Твоя задача — переписать текст пользователя, сделав его уверенным, сильным, аргументированным и продающим. Текст должен звучать максимально убедительно.";
        } else if (config.tone === "creative") {
            toneInstruction = "Ты талантливый творческий писатель. Твоя задача — переписать текст пользователя, добавив в него капельку магии: используй интересные метафоры, живые речевые обороты и красивый слог, сделав его увлекательным.";
        } else {
            toneInstruction = "Ты строгий корпоративный редактор. Улучши стиль текста пользователя, сделай его максимально профессиональным, деловым, лаконичным и вежливым. Идеально для рабочей переписки.";
        }

        systemPrompt = `${toneInstruction}
ПРАВИЛА:
1. Сделай 2 разных классных варианта текста, соответствующих заданному стилю (добавь их в массив options).
2. КРИТИЧЕСКИ ВАЖНО: Текст должен быть безупречным с точки зрения грамматики русского языка.
${baseJsonInstruction}`;
    } else if (mode === "translate") {
        temperature = 0.1;
        systemPrompt = `You are a professional translator. Translate the user's text into the following language: ${targetLang || "English"}.
CRITICAL: The translated text MUST be completely in the target language.
You must return a valid JSON object strictly in this format: { "options": [{"clean": "translation result", "html": "translation result"}] }.
Do not add any markdown, explanations, or extra text.`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "mistral-large-latest",
            temperature: temperature,
            max_tokens: 1024,
            response_format: { type: "json_object" }, 
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
            throw new Error(errMsg.toLowerCase().includes('rate limit') ? 'Rate limit exceeded' : errMsg); 
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

        const finalCleanText = result[0].clean || result[0];
        const explanation = parsedJson.explanation || null;
        await saveToHistory(textToFix, finalCleanText, mode, explanation);

        return result;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error("Таймаут сервера Mistral. Слишком долгое ожидание.");
        }
        throw error;
    }
}