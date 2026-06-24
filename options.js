document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);

function saveOptions() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const tone = document.getElementById('toneSelect').value;
    
    chrome.storage.local.set({ 
        mistralApiKey: apiKey,
        selectedTone: tone 
    }, () => {
        const status = document.getElementById('status');
        status.style.opacity = 1;
        
        setTimeout(() => { 
            status.style.opacity = 0; 
        }, 2000);
    });
}

function restoreOptions() {
    chrome.storage.local.get(['mistralApiKey', 'selectedTone'], (result) => {
        if (result.mistralApiKey) {
            document.getElementById('apiKey').value = result.mistralApiKey;
        }
        if (result.selectedTone) {
            document.getElementById('toneSelect').value = result.selectedTone;
        }
    });

    const manifestData = chrome.runtime.getManifest();
    document.getElementById('app-version').textContent = 'v' + manifestData.version;
}