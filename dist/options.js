"use strict";
// Функция для сохранения настроек
function saveOptions() {
    // Явно указываем типы элементов, чтобы TS знал об их свойствах (value)
    const apiKeyInput = document.getElementById('apiKey');
    const toneSelect = document.getElementById('toneSelect');
    const themeSelect = document.getElementById('themeSelect');
    const statusDiv = document.getElementById('status');
    const searchSelect = document.getElementById('searchEngine');
    const apiKey = apiKeyInput.value.trim();
    const selectedTone = toneSelect.value;
    const selectedTheme = themeSelect.value;
    chrome.storage.local.set({
        mistralApiKey: apiKey,
        selectedTone: selectedTone,
        selectedTheme: selectedTheme,
        searchEngine: searchSelect.value
    }, () => {
        // Показываем сообщение об успешном сохранении
        if (statusDiv) {
            statusDiv.textContent = 'Настройки успешно сохранены!';
            statusDiv.style.color = '#10b981';
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
    const searchSelect = document.getElementById('searchEngine');
    // Задаем значения по умолчанию, если в памяти еще ничего нет
    chrome.storage.local.get({
        mistralApiKey: '',
        selectedTone: 'business',
        selectedTheme: 'auto',
        searchEngine: 'google'
    }, (items) => {
        apiKeyInput.value = items.mistralApiKey;
        toneSelect.value = items.selectedTone;
        themeSelect.value = items.selectedTheme;
        searchSelect.value = items.searchEngine;
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
    // 🔥 ИСПРАВЛЕНО: теперь скрипт ищет правильный id="app-version"
    const versionBadge = document.getElementById('app-version');
    if (versionBadge) {
        const manifest = chrome.runtime.getManifest();
        versionBadge.textContent = `v${manifest.version}`;
    }
});
