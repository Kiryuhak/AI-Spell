// Функция для сохранения настроек
// Изменяем функцию на асинхронную (async)
async function saveOptions(): Promise<void> {
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    const toneSelect = document.getElementById('toneSelect') as HTMLSelectElement;
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;    
    const searchSelect = document.getElementById('searchEngine') as HTMLSelectElement; 
    const statusDiv = document.getElementById('status') as HTMLElement; 
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    
    const apiKey = apiKeyInput.value.trim();

    // 1. Анимация загрузки на кнопке
    const originalBtnText = saveBtn.textContent;
    saveBtn.textContent = 'Проверка ключа...';
    saveBtn.style.opacity = '0.7';
    saveBtn.disabled = true;

    // 2. ПРОВЕРКА КЛЮЧА
    if (apiKey) {
        try {
            // Делаем тестовый запрос к бесплатному эндпоинту Mistral
            const response = await fetch('https://api.mistral.ai/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            
            if (!response.ok) {
                // Если Mistral ответил ошибкой (например, 401 Unauthorized)
                statusDiv.textContent = '❌ Ошибка: Неверный API ключ!';
                statusDiv.style.color = '#ef4444'; // Красный
                statusDiv.style.display = 'block';
                
                saveBtn.textContent = originalBtnText;
                saveBtn.style.opacity = '1';
                saveBtn.disabled = false;
                return; // Прерываем сохранение!
            }
        } catch (error) {
            console.error("Ошибка сети при проверке ключа", error);
        }
    }

    // 3. Сохраняем, если всё отлично
    chrome.storage.local.set({
        mistralApiKey: apiKey,
        selectedTone: toneSelect.value,
        selectedTheme: themeSelect.value,
        searchEngine: searchSelect.value 
    }, () => {
        if (statusDiv) {
            statusDiv.textContent = '✓ Настройки успешно сохранены!';
            statusDiv.style.color = '#10b981'; // Зеленый
            statusDiv.style.display = 'block';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
        }
        // Возвращаем кнопку в норму
        saveBtn.textContent = originalBtnText;
        saveBtn.style.opacity = '1';
        saveBtn.disabled = false;
    });
}

// Функция для восстановления настроек при открытии страницы
function restoreOptions(): void {
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    const toneSelect = document.getElementById('toneSelect') as HTMLSelectElement;
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
    const searchSelect = document.getElementById('searchEngine') as HTMLSelectElement; 
    
    // Задаем значения по умолчанию, если в памяти еще ничего нет
    chrome.storage.local.get({
        mistralApiKey: '',
        selectedTone: 'business',
        selectedTheme: 'auto',
        searchEngine: 'google' 
    }, (items) => {
        apiKeyInput.value = items.mistralApiKey as string;
        toneSelect.value = items.selectedTone as string;
        themeSelect.value = items.selectedTheme as string;
        searchSelect.value = items.searchEngine as string; 
    });
}

// Назначаем обработчики событий после загрузки HTML-страницы
// Назначаем обработчики событий после загрузки HTML-страницы
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
    
    // Находим кнопку сохранения и вешаем на нее клик
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement | null;
    if (saveBtn) {
        saveBtn.addEventListener('click', saveOptions);
    }

    // Автоматическая подстановка версии расширения
    const versionBadge = document.getElementById('app-version');
    if (versionBadge) {
        const manifest = chrome.runtime.getManifest();
        versionBadge.textContent = `v${manifest.version}`;
    }

    // 🔥 ЛОГИКА ДЛЯ ГЛАЗКА ПАРОЛЯ
    const toggleBtn = document.getElementById('toggleApiKey');
    const eyeIcon = document.getElementById('eyeIcon');
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;

    if (toggleBtn && eyeIcon && apiKeyInput) {
        toggleBtn.addEventListener('click', () => {
            // Проверяем, какой сейчас тип у поля (скрытый или открытый)
            const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
            apiKeyInput.setAttribute('type', type);
            
            // Если текст открыт -> рисуем перечеркнутый глаз
            if (type === 'text') {
                eyeIcon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                // Если скрыт -> рисуем обычный глаз
                eyeIcon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        });
    }
    
});