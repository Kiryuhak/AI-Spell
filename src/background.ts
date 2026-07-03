chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        chrome.runtime.openOptionsPage();
    }
    
    // --- ИНТЕГРАЦИЯ В КОНТЕКСТНОЕ МЕНЮ БРАУЗЕРА ---
    chrome.contextMenus.create({ id: "ai-spell-root", title: "✨ AI-Spell: Действия с текстом", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "spellcheck", parentId: "ai-spell-root", title: "Исправить ошибки", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "style", parentId: "ai-spell-root", title: "Переписать текст", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "translate", parentId: "ai-spell-root", title: "Перевести", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "layout", parentId: "ai-spell-root", title: "Исправить раскладку", contexts: ["selection"] });
});

// Слушаем клики по контекстному меню и отправляем команду на страницу
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (tab?.id && info.selectionText) {
        chrome.tabs.sendMessage(tab.id, { 
            action: "contextMenuClicked", 
            mode: info.menuItemId,
            text: info.selectionText // Принудительно передаем текст!
        });
    }
});

// --- СЛУШАЕМ ОФИЦИАЛЬНЫЕ ХОТКЕИ CHROME ---
chrome.commands.onCommand.addListener((command) => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "hotkeyTriggered", mode: command });
        }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openHistory") {
        chrome.tabs.create({ url: chrome.runtime.getURL("history.html") });
        return true;
    }
});

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "geminiStream") {
        port.onMessage.addListener(async (request) => {
            if (request.action === "callGemini") {
                try {
                    await processTextStream(request.text, request.context, request.mode, request.targetLang, port);
                } catch (error: any) {
                    port.postMessage({ status: "error", error: error.message });
                }
            }
        });
    }
});

async function getApiKeyAndTone(): Promise<{apiKey: string, tone: string}> {
    return new Promise((resolve) => {
        chrome.storage.local.get(['mistralApiKey', 'selectedTone'], (result) => {
            resolve({ apiKey: result.mistralApiKey as string, tone: (result.selectedTone as string) || 'business' });
        });
    });
}

async function saveToHistory(originalText: string, resultObj: any, mode: string): Promise<void> {
    return new Promise<void>((resolve) => {
        chrome.storage.local.get(['geminiHistory'], (res) => {
            let history = (res.geminiHistory as any[]) || [];
            if (!Array.isArray(history)) history = [];
            history.push({ mode: mode || "unknown", originalText: originalText || "", result: resultObj || {}, timestamp: new Date().toISOString() });
            if (history.length > 100) history.shift();
            chrome.storage.local.set({ geminiHistory: history }, () => resolve());
        });
    });
}

async function processTextStream(text: string, context: string, mode: string, targetLang: string, port: chrome.runtime.Port) {
    const { apiKey, tone } = await getApiKeyAndTone();

    if (!apiKey) throw new Error("API ключ не настроен. Пожалуйста, зайдите в настройки расширения.");

    let systemPrompt = "";
    let temperature = 0.7;

    const baseInstruction = `CRITICAL INSTRUCTION: You are a strict text-processing API. 
You will receive a [CONTEXT] block and a [TARGET] block. 
[CONTEXT] is strictly READ-ONLY background information so you understand the situation. 
Your ONLY task is to process the [TARGET] block and return the exact replacement for it. 
RULE 1: NEVER output any text from the [CONTEXT] block!
RULE 2: If [TARGET] is a single word, your response MUST be exactly a single word.
RULE 3: DO NOT include greetings or explanations.
RULE 4: PRESERVE ALL HTML TAGS in the [TARGET] exactly as they are. Do not remove or change HTML formatting (like <b>, <i>, <a>).
START YOUR RESPONSE IMMEDIATELY with the processed [TARGET].`;

    const highlightInstruction = `If you change or add a word in the [TARGET], YOU MUST wrap it in double asterisks (e.g., **word**).`;

    if (mode === "spellcheck") {
        temperature = 0.1;
        systemPrompt = `Ты профессиональный русский корректор. Исправь грамматические, орфографические, пунктуационные и речевые ошибки ТОЛЬКО в блоке [TARGET].\n\n${baseInstruction}\n${highlightInstruction}`;
    } else if (mode === "layout") {
        temperature = 0.1;
        systemPrompt = `Расшифруй текст из неправильной раскладки клавиатуры ТОЛЬКО для блока [TARGET].\n\n${baseInstruction}\n${highlightInstruction}`;
    } else if (mode === "translate") {
        temperature = 0.2;
        const lang = targetLang || "Русский";
        systemPrompt = `Переведи ТОЛЬКО блок [TARGET] на язык: ${lang}. Сохрани смысл.\n\n${baseInstruction}`;
    } else if (mode === "style") {
        temperature = 0.3; 
        const toneMap: Record<string, string> = { 'business': 'строгий, деловой, профессиональный', 'friendly': 'дружелюбный, открытый, разговорный', 'persuasive': 'убедительный, сильный, продающий', 'creative': 'креативный, живой, с использованием метафор' };
        const activeTone = toneMap[tone] || 'профессиональный';
        systemPrompt = `Ты профессиональный редактор. Перепиши ТОЛЬКО блок [TARGET], строго используя стиль: "${activeTone}".\nНе придумывай новые факты. Сохрани оригинальный смысл на 100%.\n\n${baseInstruction}\n${highlightInstruction}`;
    } else if (mode === "emoji") {
        temperature = 0.6;
        systemPrompt = `Добавь подходящие по смыслу эмодзи ТОЛЬКО в текст блока [TARGET].\n\n${baseInstruction}`;
    }

    const finalUserMessage = `[CONTEXT]\n${context || text}\n\n[TARGET]\n${text}`;
    const payload = { model: "mistral-large-latest", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: finalUserMessage }], temperature: temperature, stream: true };

    // --- 🛡 ЗАЩИТА "ОТ ДУРАКА": ТАЙМАУТ 15 СЕКУНД ---
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
        response = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (error: any) {
        if (error.name === 'AbortError') throw new Error("Сервер не ответил за 15 секунд (Таймаут). Повторите попытку.");
        throw error;
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Ошибка сервера: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Не удалось прочитать поток данных");
    
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; 
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
                const dataStr = trimmedLine.slice(6);
                if (dataStr === '[DONE]') continue;
                try {
                    const data = JSON.parse(dataStr);
                    const content = data.choices[0]?.delta?.content;
                    if (content) {
                        fullText += content;
                        port.postMessage({ status: "chunk", text: content });
                    }
                } catch (e) {}
            }
        }
    }
    port.postMessage({ status: "done" });
    const cleanTextForHistory = fullText.replace(/\*\*/g, '');
    await saveToHistory(text, { clean: cleanTextForHistory, html: cleanTextForHistory }, mode);
}