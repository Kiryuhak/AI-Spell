"use strict";
// Функция для сохранения настроек
function saveOptions() {
    // Явно указываем типы элементов, чтобы TS знал об их свойствах (value)
    const apiKeyInput = document.getElementById('apiKey');
    const toneSelect = document.getElementById('toneSelect');
    const themeSelect = document.getElementById('themeSelect');
    const statusDiv = document.getElementById('status'); // Блок для вывода сообщения об успехе
    const searchSelect = document.getElementById('searchEngine'); // Добавили
    const apiKey = apiKeyInput.value.trim();
    const selectedTone = toneSelect.value;
    const selectedTheme = themeSelect.value;
    // ... ниже внутри chrome.storage.local.set:
    chrome.storage.local.set({
        mistralApiKey: apiKey,
        selectedTone: selectedTone,
        selectedTheme: selectedTheme,
        searchEngine: searchSelect.value // Добавили
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
function restoreOptions() {
    const apiKeyInput = document.getElementById('apiKey');
    const toneSelect = document.getElementById('toneSelect');
    const themeSelect = document.getElementById('themeSelect');
    const searchSelect = document.getElementById('searchEngine'); // Добавили
    // Задаем значения по умолчанию, если в памяти еще ничего нет
    chrome.storage.local.get({
        mistralApiKey: '',
        selectedTone: 'business',
        selectedTheme: 'auto',
        searchEngine: 'google' // Значение по умолчанию
    }, (items) => {
        apiKeyInput.value = items.mistralApiKey;
        toneSelect.value = items.selectedTone;
        themeSelect.value = items.selectedTheme;
        searchSelect.value = items.searchEngine; // Восстанавливаем выбор
    });
}
// Назначаем обработчики событий после загрузки HTML-страницы
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
    // Находим кнопку сохранения и вешаем на нее клик
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveOptions);
    }
});
