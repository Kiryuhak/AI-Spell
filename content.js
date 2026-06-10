let currentSelection = { text: "", range: null, activeElement: null, start: null, end: null, isInput: false };
let popupUI = null;

document.addEventListener('mouseup', (e) => {
    if (e.target.closest('#gemini-extension-ui')) return;

    setTimeout(() => {
        const text = getSelectedText();
        if (text && text.trim().length > 0) {
            saveSelectionState();
            showToolbarMenu(e.pageX, e.pageY); // Теперь сначала показываем тулбар
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

// 1. ГОРИЗОНТАЛЬНАЯ ПАНЕЛЬ ИНСТРУМЕНТОВ (Тулбар)
function showToolbarMenu(x, y) {
    closePopup();

    popupUI = document.createElement('div');
    popupUI.id = 'gemini-extension-ui';
    popupUI.style.cssText = `
        position: absolute; left: ${x}px; top: ${y + 15}px;
        background: #ffffff; border: 1px solid #e0e0e0;
        box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        border-radius: 8px; z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif; font-size: 14px;
        color: #333; display: flex; align-items: center; padding: 4px; gap: 2px;
    `;

    const createBtn = (icon, text, title, onClick) => {
        const btn = document.createElement('div');
        btn.innerHTML = `<span style="font-size: 16px;">${icon}</span>${text ? `<span style="margin-left: 6px; font-weight: 500;">${text}</span>` : ''}`;
        btn.title = title;
        btn.style.cssText = `padding: 6px 10px; cursor: pointer; border-radius: 6px; display: flex; align-items: center; transition: background 0.1s; color: #444;`;
        btn.onmouseover = () => btn.style.backgroundColor = '#f0f2f5';
        btn.onmouseout = () => btn.style.backgroundColor = 'transparent';
        btn.onclick = (e) => { e.stopPropagation(); onClick(e, btn); };
        return btn;
    };

    const divider = () => {
        const d = document.createElement('div');
        d.style.cssText = `width: 1px; height: 18px; background: #e0e0e0; margin: 0 4px;`;
        return d;
    };

    // Кнопка 1: Поиск в Google
    popupUI.appendChild(createBtn('🔍', '', 'Искать в Google', () => {
        window.open('https://www.google.com/search?q=' + encodeURIComponent(currentSelection.text), '_blank');
        closePopup();
    }));

    popupUI.appendChild(divider());

    // Кнопка 2: Редактировать (Разворачивает AI меню)
    popupUI.appendChild(createBtn('✨', 'Редактировать', 'Функции нейросети', () => {
        const rect = popupUI.getBoundingClientRect();
        showAIMenu(rect.left + window.scrollX, rect.top + window.scrollY);
    }));

    popupUI.appendChild(divider());

    // Кнопка 3: Копировать
    popupUI.appendChild(createBtn('📋', '', 'Копировать', (e, btn) => {
        navigator.clipboard.writeText(currentSelection.text);
        btn.innerHTML = `<span style="font-size: 16px;">✅</span>`;
        setTimeout(() => closePopup(), 1000);
    }));

    popupUI.appendChild(divider());

    // Кнопка 4: Перевести
    popupUI.appendChild(createBtn('🌐', '', 'Перевести', () => {
        handleActionClick('translate');
    }));

    document.body.appendChild(popupUI);
    adjustPopupPosition(x, y);
}

// 2. ВЕРТИКАЛЬНОЕ МЕНЮ AI (Открывается по кнопке "Редактировать")
function showAIMenu(x, y) {
    closePopup();

    popupUI = document.createElement('div');
    popupUI.id = 'gemini-extension-ui';
    popupUI.style.cssText = `
        position: absolute; left: ${x}px; top: ${y}px;
        background: #fff; border: 1px solid #e0e0e0;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        border-radius: 12px; z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif; font-size: 14px;
        color: #333; width: max-content; min-width: 200px; max-width: 360px; 
        overflow: hidden; line-height: 1.5;
    `;

    const createMenuBtn = (icon, text, mode) => {
        const btn = document.createElement('div');
        btn.innerHTML = `<span style="margin-right: 10px; font-size: 16px;">${icon}</span>${text}`;
        btn.style.cssText = `padding: 10px 16px; cursor: pointer; transition: background 0.2s; display: flex; align-items: center;`;
        btn.onmouseover = () => btn.style.backgroundColor = '#f4f6f8';
        btn.onmouseout = () => btn.style.backgroundColor = 'transparent';
        btn.onclick = () => handleActionClick(mode);
        return btn;
    };

    popupUI.appendChild(createMenuBtn('✍️', 'Исправить ошибки', 'spellcheck'));
    popupUI.appendChild(createMenuBtn('🔄', 'Другими словами', 'rephrase'));
    popupUI.appendChild(createMenuBtn('✨', 'Улучшить стиль', 'style'));
    popupUI.appendChild(createMenuBtn('😊', 'Подобрать эмодзи', 'emoji'));

    document.body.appendChild(popupUI);
    adjustPopupPosition(x, y);
}

// 3. ОТПРАВКА ЗАПРОСА К НЕЙРОСЕТИ
function handleActionClick(mode) {
    // Превращаем тулбар или меню в лоадер
    popupUI.style.width = 'max-content';
    popupUI.innerHTML = `<div style="padding: 12px 16px; font-weight: 500; color: #555; display: flex; align-items: center; gap: 8px;"><span>⚡</span> Думаю...</div>`;
    
    chrome.runtime.sendMessage({ action: "callGemini", text: currentSelection.text, mode: mode }, (response) => {
        if (chrome.runtime.lastError) {
            popupUI.innerHTML = `<div style="padding: 12px 16px; color: #d32f2f;">Сбой связи. Выделите текст заново.</div>`;
            setTimeout(closePopup, 3000);
            return;
        }

        if (response && response.success) {
            showResultsMenu(response.data, mode);
        } else {
            popupUI.innerHTML = `<div style="padding: 12px 16px; color: #d32f2f;">Ошибка: ${response ? response.error : 'Неизвестная ошибка'}</div>`;
            setTimeout(closePopup, 4000);
        }
    });
}

// 4. ПОКАЗ РЕЗУЛЬТАТОВ (КАРТОЧКИ)
function showResultsMenu(options, mode) {
    popupUI.innerHTML = '';
    
    const header = document.createElement('div');
    if (mode === "emoji") header.textContent = 'Варианты с эмодзи:';
    else if (mode === "translate") header.textContent = 'Перевод:';
    else header.textContent = 'Выберите вариант:';
    
    header.style.cssText = 'padding: 10px 16px; font-size: 13px; font-weight: 600; color: #666; border-bottom: 1px solid #eaeaea; background: #fdfdfd; display: flex; justify-content: space-between; align-items: center;';
    
    // Кнопка закрытия окна результатов
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✖';
    closeBtn.style.cssText = 'cursor: pointer; color: #999; padding: 2px 6px; border-radius: 4px;';
    closeBtn.onmouseover = () => closeBtn.style.background = '#eee';
    closeBtn.onmouseout = () => closeBtn.style.background = 'transparent';
    closeBtn.onclick = closePopup;
    header.appendChild(closeBtn);
    
    popupUI.appendChild(header);

    if (!document.getElementById('gemini-styles')) {
        const style = document.createElement('style');
        style.id = 'gemini-styles';
        style.textContent = `
            #gemini-extension-ui mark { background: #dcfce7; color: #166534; padding: 2px 4px; border-radius: 4px; font-weight: 500; }
            .gemini-btn-action { 
                background: #f1f3f4; border: none; border-radius: 6px; padding: 6px 12px; 
                font-size: 13px; cursor: pointer; color: #333; display: flex; align-items: center; gap: 6px; 
                transition: background 0.2s; font-family: inherit; font-weight: 500;
            }
            .gemini-btn-action:hover { background: #e4e6e8; }
        `;
        document.head.appendChild(style);
    }

    options.forEach((opt, index) => {
        const item = document.createElement('div');
        item.style.cssText = `padding: 14px 16px; border-bottom: ${index < options.length - 1 ? '1px solid #eaeaea' : 'none'};`;
        
        const textContainer = document.createElement('div');
        textContainer.innerHTML = opt.html || opt.clean || opt;
        textContainer.style.cssText = `word-wrap: break-word; white-space: pre-wrap; margin-bottom: 12px;`;
        
        const actionsContainer = document.createElement('div');
        actionsContainer.style.cssText = `display: flex; gap: 8px;`;

        const replaceBtn = document.createElement('button');
        replaceBtn.className = 'gemini-btn-action';
        replaceBtn.innerHTML = `<span>↵</span> Заменить`;
        replaceBtn.onclick = (e) => {
            e.preventDefault();
            insertTextToDOM(opt.clean || opt);
            closePopup();
        };

        const copyBtn = document.createElement('button');
        copyBtn.className = 'gemini-btn-action';
        copyBtn.innerHTML = `📋`;
        copyBtn.title = "Копировать в буфер";
        copyBtn.onclick = (e) => {
            e.preventDefault();
            navigator.clipboard.writeText(opt.clean || opt);
            copyBtn.innerHTML = `✅`;
            setTimeout(() => copyBtn.innerHTML = `📋`, 1500); 
        };

        actionsContainer.appendChild(replaceBtn);
        actionsContainer.appendChild(copyBtn);

        item.appendChild(textContainer);
        item.appendChild(actionsContainer);
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