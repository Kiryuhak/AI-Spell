// Описываем структуру данных нашей истории для TypeScript
interface HistoryItem {
    mode: string;
    originalText: string;
    result: any;
    timestamp: string;
}

document.addEventListener('DOMContentLoaded', () => {
    const historyContainer = document.getElementById('history-container') || document.querySelector('.history-container');
    const clearBtn = document.getElementById('clear-history') || document.querySelector('button');

    function getModeName(mode: string): string {
        const modes: { [key: string]: string } = {
            'spellcheck': '📝 Исправление ошибок',
            'rephrase': '🔄 Другими словами',
            'style': '✨ Переписывание текста',
            'emoji': '😊 Эмодзи',
            'translate': '🌐 Перевод',
            'layout': '⌨️ Исправление раскладки'
        };
        return modes[mode] || mode;
    }

    function extractText(data: any): string {
        if (!data) return "Нет данных";
        let parsedData = data;
        if (typeof data === 'string') {
            try { parsedData = JSON.parse(data); } catch (e) { return data; }
        }
        if (typeof parsedData === 'object' && parsedData !== null) {
            return parsedData.html || parsedData.clean || parsedData.corrected_text || parsedData.response || parsedData.text || parsedData.result || JSON.stringify(parsedData);
        }
        return String(data);
    }

    function extractExplanation(data: any): string {
        if (!data) return "";
        let parsedData = data;
        if (typeof data === 'string') {
            try { parsedData = JSON.parse(data); } catch (e) { return ""; }
        }
        
        if (typeof parsedData === 'object' && parsedData !== null && parsedData.explanation) {
            let exp = parsedData.explanation;
            if (typeof exp === 'string') return exp;
            if (Array.isArray(exp)) {
                return exp.map((e: any) => typeof e === 'string' ? e : JSON.stringify(e)).join('<br>');
            }
            return JSON.stringify(exp);
        }
        return "";
    }

    function renderHistory(): void {
        chrome.storage.local.get(['geminiHistory'], (res) => {
            // Говорим TypeScript, что тут лежит именно массив истории (as HistoryItem[])
            const history = (res.geminiHistory as HistoryItem[]) || [];
            if (!historyContainer) return;

            if (history.length === 0) {
                historyContainer.innerHTML = '<div style="text-align: center; color: #64748b; margin-top: 40px;">История пуста. Здесь будут появляться ваши запросы.</div>';
                return;
            }

            historyContainer.innerHTML = ''; 
            const reversedHistory = [...history].reverse();

            reversedHistory.forEach((item) => {
                const historyItem = document.createElement('div');
                historyItem.style.cssText = `
                    background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;
                    padding: 16px; margin-bottom: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                `;

                const header = document.createElement('div');
                header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 13px; color: #64748b;';
                
                const modeSpan = document.createElement('span');
                modeSpan.style.cssText = 'font-weight: 600; color: #1e293b; background: #f1f5f9; padding: 4px 10px; border-radius: 6px;';
                modeSpan.textContent = getModeName(item.mode);
                
                const dateSpan = document.createElement('span');
                const date = new Date(item.timestamp);
                dateSpan.textContent = date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

                header.appendChild(modeSpan);
                header.appendChild(dateSpan);

                const originalBlock = document.createElement('div');
                originalBlock.style.cssText = 'margin-bottom: 12px;';
                originalBlock.innerHTML = `<div style="font-size: 12px; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; font-weight: 600;">Исходный текст:</div>
                                         <div style="color: #475569; font-size: 14px; background: #f8fafc; padding: 10px; border-radius: 8px; font-style: italic;">${item.originalText}</div>`;

                const resultBlock = document.createElement('div');
                const cleanResult = extractText(item.result);
                const explanation = extractExplanation(item.result);

                let expHtml = "";
                if (explanation) {
                    expHtml = `<div style="margin-top: 10px; padding: 10px; font-size: 13px; color: #64748b; background: #f1f5f9; border-radius: 8px; border-left: 3px solid #3b82f6; line-height: 1.4;">
                                   <b>💡 Объяснение:</b><br>${explanation}
                               </div>`;
                }

                resultBlock.innerHTML = `<div style="font-size: 12px; text-transform: uppercase; color: #10b981; margin-bottom: 4px; font-weight: 600;">Результат:</div>
                                         <div style="color: #1e293b; font-size: 14px; background: #ecfdf5; padding: 10px; border-radius: 8px; border: 1px solid #d1fae5;">${cleanResult}</div>
                                         ${expHtml}`;

                historyItem.appendChild(header);
                historyItem.appendChild(originalBlock);
                historyItem.appendChild(resultBlock);
                historyContainer.appendChild(historyItem);
            });
        });
    }

    renderHistory();

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Вы уверены, что хотите очистить всю историю?')) {
                chrome.storage.local.set({ geminiHistory: [] }, () => {
                    renderHistory();
                });
            }
        });
    }
});