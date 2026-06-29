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

// Достаем ключ и тональность из настроек расширения
async function getApiKeyAndTone(): Promise<{apiKey: string, tone: string}> {
    return new Promise((resolve) => {
        chrome.storage.local.get(['mistralApiKey', 'selectedTone'], (result) => {
            resolve({
                apiKey: result.mistralApiKey as string,
                tone: (result.selectedTone as string) || 'business'
            });
        });
    });
}

// ---------------------------------------------------------
// ОБНОВЛЕННАЯ ФУНКЦИЯ СОХРАНЕНИЯ ИСТОРИИ 
// ---------------------------------------------------------
async function saveToHistory(originalText: string, resultObj: any, mode: string): Promise<void> {
    // Явно указываем Promise<void>, так как мы ничего не возвращаем
    return new Promise<void>((resolve) => {
        chrome.storage.local.get(['geminiHistory'], (res) => {
            // Подсказываем TypeScript, что из памяти приедет массив
            let history = (res.geminiHistory as any[]) || [];
            
            // Жесткая защита
            if (!Array.isArray(history)) {
                history = [];
            }

            history.push({
                mode: mode || "unknown",
                originalText: originalText || "",
                result: resultObj || {},
                timestamp: new Date().toISOString()
            });
            
            // Храним только 100 последних записей
            if (history.length > 100) {
                history.shift();
            }
            
            // Оборачиваем resolve в пустую стрелочную функцию
            chrome.storage.local.set({ geminiHistory: history }, () => {
                console.log("Запись успешно добавлена в историю!");
                resolve(); 
            });
        });
    });
}

async function processText(text, mode, targetLang) {
    const { apiKey, tone } = await getApiKeyAndTone();

    if (!apiKey) {
        throw new Error("API ключ не настроен. Пожалуйста, зайдите в настройки расширения и укажите ключ Mistral.");
    }

    let systemPrompt = "";
    let temperature = 0.7;

    // ЖЕСТКИЙ ПРОМПТ: требуем строку, а не объект!
    const baseJsonInstruction = `Верни ответ СТРОГО в формате JSON с тремя ключами:
1. "clean": чистый исправленный текст без тегов.
2. "html": тот же исправленный текст, но каждое измененное, добавленное или исправленное тобой слово ОБЯЗАТЕЛЬНО оберни в тег <mark>. Пример: <mark>исправленное</mark> слово.
3. "explanation": краткое объяснение исправлений. ЗНАЧЕНИЕ ДОЛЖНО БЫТЬ ОБЫЧНОЙ СТРОКОЙ (String), не массивом и не объектом! Если ошибок не было, напиши "Ошибок не найдено".
Никаких других ключей, массивов или текста вне JSON!`;

    const simpleJsonInstruction = `Верни ответ СТРОГО в формате JSON с одним ключом "clean", содержащим итоговый текст. Никаких других ключей.`;

    if (mode === "spellcheck") {
        temperature = 0.1;
        systemPrompt = `Ты профессиональный русский корректор. Исправь грамматические, орфографические, пунктуационные и речевые ошибки в тексте пользователя.
${baseJsonInstruction}`;
    } 
    else if (mode === "layout") {
        temperature = 0.1;
        systemPrompt = `Ты умный Punto Switcher. Пользователь случайно набрал текст в неправильной раскладке клавиатуры.
Твоя задача:
1. Расшифровать текст, переведя его в правильную раскладку.
2. Расставить правильную пунктуацию и заглавные буквы.
3. Исправить возможные опечатки.
${baseJsonInstruction}`;
    } 
    else if (mode === "translate") {
        temperature = 0.3;
        const lang = targetLang || "Русский";
        systemPrompt = `Ты профессиональный переводчик. Переведи текст пользователя на следующий язык: ${lang}. Сохрани оригинальное форматирование, смысл и тон.
${simpleJsonInstruction}`;
    } 
    else if (mode === "style") {
        temperature = 0.7;
        const toneMap = {
            'business': 'строгий, деловой, профессиональный',
            'friendly': 'дружелюбный, открытый, разговорный',
            'persuasive': 'убедительный, сильный, продающий',
            'creative': 'креативный, живой, с использованием метафор'
        };
        const activeTone = toneMap[tone] || 'профессиональный';
        systemPrompt = `Ты опытный редактор. Перепиши текст пользователя, используя стиль: ${activeTone}. Сделай текст более красивым и читаемым.
${simpleJsonInstruction}`;
    } 
    else if (mode === "emoji") {
        temperature = 0.7;
        systemPrompt = `Ты эксперт по социальным сетям. Добавь подходящие по смыслу эмодзи в текст пользователя. Не переборщи.
${simpleJsonInstruction}`;
    }

    const payload = {
        model: "mistral-large-latest", 
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text }
        ],
        response_format: { type: "json_object" }, 
        temperature: temperature
    };

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Ошибка сервера Mistral: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content;
    
    let parsedResult;
    try {
        parsedResult = JSON.parse(resultText);
    } catch (e) {
        parsedResult = { clean: resultText, html: resultText };
    }

    await saveToHistory(text, parsedResult, mode);
    return [parsedResult];
}