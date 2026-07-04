document.addEventListener('DOMContentLoaded', () => {
    const historyList = document.getElementById('historyList');
    const clearBtn = document.getElementById('clearBtn');

    // Переводим технические названия в красивые русские
    const formatMode = (mode: string) => {
        const modes: Record<string, string> = { 'spellcheck': 'Ошибки', 'style': 'Стиль', 'emoji': 'Эмодзи', 'layout': 'Раскладка', 'translate': 'Перевод' };
        return modes[mode] || mode;
    };

    const renderHistory = () => {
        chrome.storage.local.get({ aiHistory: [] }, (data) => {
            
            // 🔥 ВОТ ЗДЕСЬ ДОБАВЛЯЕМ as any[]
            const history = data.aiHistory as any[]; 
            
            if (!historyList) return;
            
            if (history.length === 0) {
                historyList.innerHTML = '<div class="empty">История пуста. Ваши успешные результаты появятся здесь.</div>';
                if (clearBtn) clearBtn.style.display = 'none';
                return;
            }

            if (clearBtn) clearBtn.style.display = 'block';
            historyList.innerHTML = history.map((item: any) => `
                <div class="history-card">
                    <div class="history-header">
                        <span class="mode-badge">${formatMode(item.mode)}</span>
                        <span>${new Date(item.date).toLocaleString('ru-RU')}</span>
                    </div>
                    <div class="text-block">
                        <div class="label">Оригинал</div>
                        <div class="content">${item.original}</div>
                    </div>
                    <div class="text-block">
                        <div class="label">Результат ИИ</div>
                        <div class="content result">${item.result}</div>
                    </div>
                </div>
            `).join('');
        });
    };

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Удалить всю историю запросов? Это действие нельзя отменить.')) {
                chrome.storage.local.set({ aiHistory: [] }, renderHistory);
            }
        });
    }

    renderHistory();
});