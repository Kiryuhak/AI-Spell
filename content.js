let currentSelection = { text: "", range: null, activeElement: null, start: null, end: null, isInput: false };
let popupUI = null;

document.addEventListener('mouseup', (e) => {
    if (e.target.closest('#gemini-extension-ui')) return;

    setTimeout(() => {
        const text = getSelectedText();
        if (text && text.trim().length > 0) {
            saveSelectionState();
            showInitialMenu(e.pageX, e.pageY);
        } else {
            closePopup();
        }
    }, 10);
});

function getSelectedText() {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        return activeEl.value.substring(activeEl.selectionStart, activeEl.selectionEnd);
    }
    return window.getSelection().toString();
}

function saveSelectionState() {
    const activeEl = document.activeElement;
    const sel = window.getSelection();
    
    currentSelection = { text: "", range: null, activeElement: activeEl, start: null, end: null, isInput: false };

    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        currentSelection.isInput = true;
        currentSelection.start = activeEl.selectionStart;
        currentSelection.end = activeEl.selectionEnd;
        currentSelection.text = activeEl.value.substring(activeEl.selectionStart, activeEl.selectionEnd);
    } else if (sel.rangeCount > 0) {
        currentSelection.range = sel.getRangeAt(0).cloneRange();
        currentSelection.text = sel.toString();
    }
}

function showInitialMenu(x, y) {
    closePopup();

    popupUI = document.createElement('div');
    popupUI.id = 'gemini-extension-ui';
    // Добавили max-width и улучшили тени для компактности
    popupUI.style.cssText = `
        position: absolute; left: ${x}px; top: ${y + 15}px;
        background: #fff; border: 1px solid #e0e0e0;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        border-radius: 12px; z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif; font-size: 14px;
        color: #333; width: max-content; min-width: 200px; max-width: 360px; 
        overflow: hidden; line-height: 1.5;
    `;

    const createBtn = (icon, text, mode) => {
        const btn = document.createElement('div');
        btn.innerHTML = `<span style="margin-right: 10px; font-size: 16px;">${icon}</span>${text}`;
        btn.style.cssText = `padding: 10px 16px; cursor: pointer; transition: background 0.2s; display: flex; align-items: center;`;
        btn.onmouseover = () => btn.style.backgroundColor = '#f4f6f8';
        btn.onmouseout = () => btn.style.backgroundColor = 'transparent';
        btn.onclick = () => handleActionClick(mode);
        return btn;
    };

    popupUI.appendChild(createBtn('✍️', 'Исправить ошибки', 'spellcheck'));
    popupUI.appendChild(createBtn('🔄', 'Другими словами', 'rephrase'));
    popupUI.appendChild(createBtn('✨', 'Улучшить стиль', 'style'));
    popupUI.appendChild(createBtn('😊', 'Подобрать эмодзи', 'emoji'));

    document.body.appendChild(popupUI);
    adjustPopupPosition(x, y);
}

function handleActionClick(mode) {
    popupUI.innerHTML = `<div style="padding: 16px; font-weight: 500; color: #555; text-align: center;">⚡ Думаю...</div>`;
    
    chrome.runtime.sendMessage({ action: "callGemini", text: currentSelection.text, mode: mode }, (response) => {
        if (response.success) {
            showResultsMenu(response.data, mode);
        } else {
            popupUI.innerHTML = `<div style="padding: 16px; color: #d32f2f; text-align: center;">Ошибка: ${response.error}</div>`;
            setTimeout(closePopup, 3000);
        }
    });
}

function showResultsMenu(options, mode) {
    popupUI.innerHTML = '';
    
    const header = document.createElement('div');
    header.textContent = mode === "emoji" ? 'Варианты с эмодзи:' : 'Выберите вариант:';
    header.style.cssText = 'padding: 10px 16px; font-size: 13px; font-weight: 600; color: #666; border-bottom: 1px solid #eaeaea; background: #fdfdfd;';
    popupUI.appendChild(header);

    if (!document.getElementById('gemini-styles')) {
        const style = document.createElement('style');
        style.id = 'gemini-styles';
        style.textContent = `#gemini-extension-ui mark { background: #dcfce7; color: #166534; padding: 2px 4px; border-radius: 4px; font-weight: 500; }`;
        document.head.appendChild(style);
    }

    options.forEach((opt, index) => {
        const item = document.createElement('div');
        item.innerHTML = opt.html || opt.clean || opt;
        // Добавили word-wrap, чтобы длинный текст не ломал ширину
        item.style.cssText = `padding: 12px 16px; cursor: pointer; border-bottom: ${index < options.length - 1 ? '1px solid #eaeaea' : 'none'}; word-wrap: break-word; white-space: pre-wrap;`;
        item.onmouseover = () => item.style.backgroundColor = '#f4f6f8';
        item.onmouseout = () => item.style.backgroundColor = 'transparent';
        
        item.onclick = (e) => {
            e.preventDefault();
            insertTextToDOM(opt.clean || opt);
            closePopup();
        };
        popupUI.appendChild(item);
    });
}

function insertTextToDOM(newText) {
    const { isInput, activeElement, start, end, range } = currentSelection;

    try {
        if (isInput && activeElement) {
            const val = activeElement.value;
            activeElement.value = val.substring(0, start) + newText + val.substring(end);
            activeElement.selectionStart = activeElement.selectionEnd = start + newText.length;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (range) {
            range.deleteContents();
            const textNode = document.createTextNode(newText);
            range.insertNode(textNode);
            
            const sel = window.getSelection();
            sel.removeAllRanges();
            const newRange = document.createRange();
            newRange.setStartAfter(textNode);
            newRange.setEndAfter(textNode);
            sel.addRange(newRange);
            
            if (activeElement) activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } catch (err) {
        console.error("Ошибка вставки:", err);
    }
}

function closePopup() {
    if (popupUI) {
        popupUI.remove();
        popupUI = null;
    }
}

// Вынесли умное позиционирование в отдельную функцию, чтобы оно работало и для первичного меню
function adjustPopupPosition(mouseX, mouseY) {
    if (!popupUI) return;
    const rect = popupUI.getBoundingClientRect();
    const spaceBelow = window.innerHeight - mouseY;
    
    if (mouseX + rect.width > window.innerWidth) {
        popupUI.style.left = `${window.innerWidth - rect.width - 20 + window.scrollX}px`;
    }
    
    if (spaceBelow < rect.height + 40) {
        popupUI.style.top = `${mouseY - rect.height - 15 + window.scrollY}px`;
    }
}