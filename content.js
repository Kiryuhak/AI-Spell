let currentSelection = { text: "", range: null, activeElement: null, start: null, end: null, isInput: false };
let popupUI = null;

// Слушаем отпускание кнопки мыши
document.addEventListener('mouseup', (e) => {
    // Игнорируем клики внутри нашего собственного меню
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

// 1. ОТРИСОВКА ПЕРВИЧНОГО МЕНЮ (Как в Яндексе)
function showInitialMenu(x, y) {
    closePopup();

    popupUI = document.createElement('div');
    popupUI.id = 'gemini-extension-ui';
    popupUI.style.cssText = `
        position: absolute; left: ${x}px; top: ${y + 15}px;
        background: #fff; border: 1px solid #e0e0e0;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        border-radius: 8px; z-index: 2147483647;
        font-family: system-ui, sans-serif; font-size: 14px;
        color: #333; min-width: 200px; overflow: hidden;
    `;

    const createBtn = (icon, text, mode) => {
        const btn = document.createElement('div');
        btn.innerHTML = `<span style="margin-right: 8px;">${icon}</span>${text}`;
        btn.style.cssText = `padding: 10px 16px; cursor: pointer; transition: background 0.2s; display: flex; align-items: center;`;
        btn.onmouseover = () => btn.style.backgroundColor = '#f5f5f5';
        btn.onmouseout = () => btn.style.backgroundColor = 'transparent';
        btn.onclick = () => handleActionClick(mode);
        return btn;
    };

    popupUI.appendChild(createBtn('✍️', 'Исправить ошибки', 'spellcheck'));
    popupUI.appendChild(createBtn('🔄', 'Другими словами', 'rephrase'));
    popupUI.appendChild(createBtn('✨', 'Улучшить стиль', 'style'));
    popupUI.appendChild(createBtn('😊', 'Подобрать эмодзи', 'emoji'));

    document.body.appendChild(popupUI);
}

// 2. ОБРАБОТКА КЛИКА ПО МЕНЮ
function handleActionClick(mode) {
    // Превращаем меню в лоадер
    popupUI.innerHTML = `<div style="padding: 12px 16px; font-weight: 500; color: #666;">⚡ Обработка...</div>`;
    
    // Отправляем запрос в фоновый скрипт
    chrome.runtime.sendMessage({ action: "callGemini", text: currentSelection.text, mode: mode }, (response) => {
        if (response.success) {
            showResultsMenu(response.data, mode);
        } else {
            popupUI.innerHTML = `<div style="padding: 12px 16px; color: red;">Ошибка: ${response.error}</div>`;
            setTimeout(closePopup, 3000);
        }
    });
}

// 3. ОТРИСОВКА ВАРИАНТОВ ОТ НЕЙРОСЕТИ
function showResultsMenu(options, mode) {
    popupUI.innerHTML = '';
    
    const header = document.createElement('div');
    header.textContent = mode === "emoji" ? 'Варианты с эмодзи:' : 'Выберите вариант:';
    header.style.cssText = 'padding: 8px 16px; font-size: 12px; color: #888; border-bottom: 1px solid #eee; background: #fafafa;';
    popupUI.appendChild(header);

    // Добавляем стили для подсветки ошибок (<mark>)
    if (!document.getElementById('gemini-styles')) {
        const style = document.createElement('style');
        style.id = 'gemini-styles';
        style.textContent = `#gemini-extension-ui mark { background: #ffeeb2; color: #b47a00; padding: 0 2px; border-radius: 3px; }`;
        document.head.appendChild(style);
    }

    options.forEach((opt, index) => {
        const item = document.createElement('div');
        item.innerHTML = opt.html || opt.clean || opt;
        item.style.cssText = `padding: 10px 16px; cursor: pointer; border-bottom: ${index < options.length - 1 ? '1px solid #f0f0f0' : 'none'}`;
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

// 4. ВСТАВКА ТЕКСТА НА САЙТ
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