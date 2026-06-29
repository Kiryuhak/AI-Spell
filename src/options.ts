// Функция для сохранения настроек
function saveOptions(): void {
    // Явно указываем типы элементов, чтобы TS знал об их свойствах (value)
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    const toneSelect = document.getElementById('toneSelect') as HTMLSelectElement;
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
    const statusDiv = document.getElementById('status') as HTMLElement; // Блок для вывода сообщения об успехе

    const apiKey = apiKeyInput.value.trim();
    const selectedTone = toneSelect.value;
    const selectedTheme = themeSelect.value;

    chrome.storage.local.set({
        mistralApiKey: apiKey,
        selectedTone: selectedTone,
        selectedTheme: selectedTheme
    }, () => {
        // Показываем сообщение об успешном сохранении
        if (statusDiv) {
            statusDiv.textContent = 'Настройки успешно сохранены!';
            statusDiv.style.color = '#10b981'; // Приятный зеленый цвет
            statusDiv.style.display = 'block';
            
            // Прячем сообщение через 2 секунды
            setTimeout(() => {
                statusDiv.style.display = 'none';
                statusDiv.textContent = '';
            }, 2000);
        }
    });
}

// Функция для восстановления настроек при открытии страницы
function restoreOptions(): void {
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    const toneSelect = document.getElementById('toneSelect') as HTMLSelectElement;
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;

    // Задаем значения по умолчанию, если в памяти еще ничего нет
    chrome.storage.local.get({
        mistralApiKey: '',
        selectedTone: 'business',
        selectedTheme: 'auto'
    }, (items) => {
        // Убеждаем TypeScript, что мы кладем туда именно строки (as string)
        apiKeyInput.value = items.mistralApiKey as string;
        toneSelect.value = items.selectedTone as string;
        themeSelect.value = items.selectedTheme as string;
    });
}

// Назначаем обработчики событий после загрузки HTML-страницы
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
    
    // Находим кнопку сохранения и вешаем на нее клик
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement | null;
    if (saveBtn) {
        saveBtn.addEventListener('click', saveOptions);
    }
});