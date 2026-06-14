document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);

// Функция сохранения ключа
function saveOptions() {
    const apiKey = document.getElementById('apiKey').value.trim();
    
    // Сохраняем в локальное хранилище расширения
    chrome.storage.local.set({ mistralApiKey: apiKey }, () => {
        // Показываем сообщение об успехе
        const status = document.getElementById('status');
        status.style.opacity = 1;
        
        // Прячем сообщение через 2 секунды
        setTimeout(() => { 
            status.style.opacity = 0; 
        }, 2000);
    });
}

// Функция подгрузки сохраненного ключа при открытии страницы
function restoreOptions() {
    chrome.storage.local.get(['mistralApiKey'], (result) => {
        if (result.mistralApiKey) {
            document.getElementById('apiKey').value = result.mistralApiKey;
        }
    });
}