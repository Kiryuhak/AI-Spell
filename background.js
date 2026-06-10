import { API_KEY } from './config.js';

// Слушаем сообщения от нашего контентного скрипта (content.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "callGemini") {
    processText(request.text, request.mode)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Говорим браузеру, что ответ будет асинхронным
  }
});

async function processText(textToFix, mode) {
    let promptText = "";
    let temp = 0.1;
    
    if (mode === "spellcheck") {
        promptText = `Исправь ошибки. Дай 2 варианта. Верни СТРОГО JSON-массив: [{"clean": "чистый текст", "html": "текст, где исправленные слова обернуты в тег <mark>"}]. Никакого markdown.\n\nТекст:\n${textToFix}`;
    } else if (mode === "emoji") {
        temp = 0.7; 
        promptText = `Расставь эмодзи. Дай 3 варианта. Верни СТРОГО JSON-массив: [{"clean": "текст с эмодзи", "html": "текст с эмодзи"}]. Никакого markdown.\n\nТекст:\n${textToFix}`;
    } else if (mode === "rephrase") {
        temp = 0.5; 
        promptText = `Перепиши другими словами. Дай 3 варианта. Верни СТРОГО JSON-массив: [{"clean": "перефразированный текст", "html": "перефразированный текст"}]. Никакого markdown.\n\nТекст:\n${textToFix}`;
    } else if (mode === "style") {
        temp = 0.3; 
        promptText = `Улучши стиль текста (Tone of Voice). Сделай его профессиональным. Дай 2 варианта. Верни СТРОГО JSON-массив: [{"clean": "улучшенный текст", "html": "улучшенный текст"}]. Никакого markdown.\n\nТекст:\n${textToFix}`;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: temp, 
          maxOutputTokens: 800
        }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    if (data.candidates && data.candidates.length > 0) {
        let rawText = data.candidates[0].content.parts[0].text;
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (jsonMatch) rawText = jsonMatch[0];
        else throw new Error("Сбой формата ответа от API.");
        
        return JSON.parse(rawText);
    }
    throw new Error("Пустой ответ от нейросети.");
}