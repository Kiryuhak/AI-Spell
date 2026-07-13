// Функция для экранирования HTML-тегов (защита от XSS)
const escapeHTML = (str: string) => {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
};

document.addEventListener('DOMContentLoaded', async () => {
    const historyList = document.getElementById('historyList');
    const clearBtn = document.getElementById('clearBtn');

    const formatMode = (mode: string) => {
        const modes: Record<string, string> = { 'spellcheck': 'Ошибки', 'style': 'Стиль', 'emoji': 'Эмодзи', 'layout': 'Раскладка', 'translate': 'Перевод' };
        return modes[mode] || mode;
    };

    const renderHistory = async () => {
        // Используем современный Promise-based подход (без коллбэков)
        const data = await chrome.storage.local.get({ aiHistory: [] });
        const history = data.aiHistory as any[]; 
        
        if (!historyList) return;
        
        if (history.length === 0) {
            historyList.innerHTML = '<div class="empty">История пуста. Ваши успешные результаты появятся здесь.</div>';
            if (clearBtn) clearBtn.style.display = 'none';
            return;
        }

        if (clearBtn) clearBtn.style.display = 'block';
        
        // Рендерим историю, пропуская данные через escapeHTML
        historyList.innerHTML = history.map((item: any) => `
            <div class="history-card">
                <div class="history-header">
                    <span class="mode-badge">${formatMode(item.mode)}</span>
                    <span>${new Date(item.date).toLocaleString('ru-RU')}</span>
                </div>
                <div class="text-block">
                    <div class="label">Оригинал</div>
                    <div class="content">${escapeHTML(item.original)}</div>
                </div>
                <div class="text-block">
                    <div class="label">Результат ИИ</div>
                    <div class="content result">${escapeHTML(item.result)}</div>
                </div>
            </div>
        `).join('');
    };

    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (confirm('Удалить всю историю запросов? Это действие нельзя отменить.')) {
                await chrome.storage.local.set({ aiHistory: [] });
                renderHistory(); // Перерисовываем UI
            }
        });
    }

    renderHistory();
});