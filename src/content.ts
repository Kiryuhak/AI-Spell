interface SelectionData {
    text: string;
    range: Range | null;
    activeElement: HTMLInputElement | HTMLTextAreaElement | null;
    start: number | null;
    end: number | null;
    isInput: boolean;
}

let currentSelection: SelectionData = { text: "", range: null, activeElement: null, start: null, end: null, isInput: false };
let popupUI: HTMLElement | null = null;
let currentTargetLang: string = "Английский"; 
let currentTheme: string = 'auto';

chrome.storage.local.get(['selectedTheme'], (res) => {
    if (res.selectedTheme) currentTheme = res.selectedTheme as string; // Добавили as string
});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.selectedTheme) {
        currentTheme = changes.selectedTheme.newValue as string; // Добавили as string
    }
});

let lastAnchorX: number = 0;
let lastAnchorY: number = 0;

const ICONS: Record<string, string> = {
    google: `<svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>`,
    edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`,
    copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
translate: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,    keyboard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9333EA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" ry="2"></rect><path d="M6 8h.01"></path><path d="M10 8h.01"></path><path d="M14 8h.01"></path><path d="M18 8h.01"></path><path d="M8 12h.01"></path><path d="M12 12h.01"></path><path d="M16 12h.01"></path><path d="M7 16h10"></path></svg>`,
    check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34A853" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="8 12 11 15 16 9"></polyline></svg>`,
    replace: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D93025" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg>`,
    closeColored: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    spell: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D93025" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    style: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F9AB00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    emoji: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FA7B17" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>`,
    chevronDown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    closeStandard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    replaceCurved: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15l-5-5 5-5"></path><path d="M5 10h11a4 4 0 0 1 4 4v4"></path></svg>`,
    copyStandard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    hourglass: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F9AB00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 2 18 2 18 6 12 14 6 6 6 2"></polygon><polygon points="6 22 18 22 18 18 12 10 6 18 6 22"></polygon></svg>`,
    history: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6750A4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    dots: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>`
};

function injectStyles(): void {
    if (!document.getElementById('gemini-styles')) {
        const style = document.createElement('style');
        style.id = 'gemini-styles';
        style.textContent = `
            #gemini-extension-ui {
                --bg-primary: #ffffff;
                --bg-secondary: #f1f5f9;
                --text-primary: #1e293b;
                --text-secondary: #64748b;
                --border-color: rgba(0,0,0,0.06);
                --hover-bg: #e2e8f0;
                --shadow-color: rgba(0,0,0,0.1);
                transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.2, 0, 0, 1);
                border-radius: 12px;
                box-shadow: 0 8px 24px -4px var(--shadow-color), 0 4px 8px -4px var(--shadow-color);
                border: 1px solid var(--border-color);
            }
            #gemini-extension-ui[data-theme="dark"] {
                --bg-primary: #1e1e24;
                --bg-secondary: #2b2b36;
                --text-primary: #f8fafc;
                --text-secondary: #94a3b8;
                --border-color: rgba(255,255,255,0.08);
                --hover-bg: #3f3f46;
                --shadow-color: rgba(0,0,0,0.5);
            }
            @keyframes gemini-spin { to { transform: rotate(360deg); } } 
            @keyframes gemini-flip { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(180deg); } }
            .gemini-loader { width: 14px; height: 14px; border: 2.5px solid var(--text-secondary); border-top-color: transparent; border-radius: 50%; animation: gemini-spin 0.8s linear infinite; }
            .gemini-hourglass { animation: gemini-flip 2s ease-in-out infinite; display: flex; align-items: center; justify-content: center; }
            #gemini-extension-ui mark { background: #dcfce7; color: #166534; padding: 2px 4px; border-radius: 4px; font-weight: 500; }
            #gemini-extension-ui[data-theme="dark"] mark { background: #0f5223; color: #c4eed0; }
            .gemini-btn-action, .gemini-translate-btn { 
                background: var(--bg-secondary); border: none; border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; color: var(--text-primary); display: flex; align-items: center; gap: 6px; font-family: inherit; font-weight: 500; transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
            }
            .gemini-btn-action:hover, .gemini-translate-btn:hover { background: var(--hover-bg); }
            .gemini-btn-action:active, .gemini-translate-btn:active { transform: translateY(1px) scale(0.98); }
            .gemini-translate-btn.icon-only { padding: 6px; }
            .gemini-scroll::-webkit-scrollbar { width: 6px; }
            .gemini-scroll::-webkit-scrollbar-track { background: transparent; }
            .gemini-scroll::-webkit-scrollbar-thumb { background: var(--text-secondary); border-radius: 4px; }
        `;
        document.head.appendChild(style);
    }
}

function applyThemeToPopup(popup: HTMLElement): void {
    let isDark = currentTheme === 'dark' || (currentTheme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
        popup.setAttribute('data-theme', 'dark');
    } else {
        popup.removeAttribute('data-theme');
    }
}

function getPopupContainer(): HTMLElement {
    let container: HTMLElement = document.body;
    const activeEl = document.activeElement;
    if (activeEl && activeEl.closest('dialog')) {
        container = activeEl.closest('dialog') as HTMLElement;
    } else {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            let node = sel.anchorNode;
            if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
            if (node && (node as Element).closest('dialog')) {
                container = (node as Element).closest('dialog') as HTMLElement;
            }
        }
    }
    return container;
}

document.addEventListener('mousedown', (e: MouseEvent) => {
    if (popupUI) {
        if (!popupUI.contains(e.target as Node)) {
            closePopup();
        } else {
            const moreWrap = document.getElementById('gemini-more-btn-wrap');
            const moreDropdown = document.getElementById('gemini-more-dropdown');
            if (moreWrap && moreDropdown && !moreWrap.contains(e.target as Node)) {
                moreDropdown.style.display = 'none';
            }
        }
    }
}, true);

document.addEventListener('mouseup', (e: MouseEvent) => {
    if ((e.target as Element).closest('#gemini-extension-ui')) return;
    setTimeout(() => {
        const text = getSelectedText();
        if (text && text.trim().length > 0) {
            saveSelectionState();
            const coords = getSelectionCoords();
            showToolbarMenu(coords.x, coords.y);
        }
    }, 10);
}, true);

document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.target as Element).closest('#gemini-extension-ui')) return;
    const isSelectAll = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a';
    if (isSelectAll) {
        setTimeout(() => {
            const text = getSelectedText();
            if (text && text.trim().length > 0) {
                saveSelectionState();
                const coords = getSelectionCoords();
                showToolbarMenu(coords.x, coords.y);
            }
        }, 50);
        return;
    }
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const key = e.key.toLowerCase();
        let mode: string | null = null;
        if (key === 'r' || key === 'к') mode = 'spellcheck';
        else if (key === 'y' || key === 'н') mode = 'style';
        else if (key === 't' || key === 'е') mode = 'emoji';

        if (mode) {
            const text = getSelectedText();
            if (text && text.trim().length > 0) {
                e.preventDefault(); 
                saveSelectionState();
                const coords = getSelectionCoords();
                showAIMenu(coords.x, coords.y);
                handleActionClick(mode);
            }
        }
    }
}, true);

function getSelectedText(): string {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement;
        return inputEl.value.substring(inputEl.selectionStart || 0, inputEl.selectionEnd || 0);
    }
    return window.getSelection()?.toString() || "";
}

function saveSelectionState(): void {
    const activeEl = document.activeElement;
    const sel = window.getSelection();
    currentSelection = { text: "", range: null, activeElement: null, start: null, end: null, isInput: false };

    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement;
        currentSelection.isInput = true;
        currentSelection.activeElement = inputEl;
        currentSelection.start = inputEl.selectionStart;
        currentSelection.end = inputEl.selectionEnd;
        currentSelection.text = inputEl.value.substring(inputEl.selectionStart || 0, inputEl.selectionEnd || 0);
    } else if (sel && sel.rangeCount > 0) {
        currentSelection.range = sel.getRangeAt(0).cloneRange();
        currentSelection.text = sel.toString();
    }
}

function getSelectionCoords(): { x: number, y: number } {
    const activeEl = document.activeElement;
    let rect: DOMRect | null = null;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        rect = activeEl.getBoundingClientRect();
    } else {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            rect = sel.getRangeAt(0).getBoundingClientRect();
        }
    }
    if (rect) {
        return { x: rect.left, y: rect.bottom };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function showToolbarMenu(x: number, y: number): void {
    closePopup();
    injectStyles();
    lastAnchorX = x;
    lastAnchorY = y;

    popupUI = document.createElement('div');
    popupUI.id = 'gemini-extension-ui';
    applyThemeToPopup(popupUI);
    
    popupUI.addEventListener('mousedown', e => e.stopPropagation());
    popupUI.addEventListener('mouseup', e => e.stopPropagation());
    popupUI.addEventListener('click', e => e.stopPropagation());
    
    popupUI.style.cssText = `
        position: fixed !important; left: -9999px; top: -9999px;
        background: var(--bg-primary); 
        z-index: 2147483647 !important;
        font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
        color: var(--text-primary); display: flex; align-items: center; padding: 4px; gap: 2px;
    `;

    const createBtn = (icon: string, text: string, title: string, onClick: (e: MouseEvent, btn: HTMLButtonElement) => void) => {
        const btn = document.createElement('button');
        btn.type = 'button'; 
        btn.innerHTML = `<span style="display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">${icon}</span>${text ? `<span style="margin-left: 6px; font-weight: 500;">${text}</span>` : ''}`;
        btn.title = title;
        btn.style.cssText = `padding: 6px 8px; cursor: pointer; border-radius: 8px; display: flex; align-items: center; transition: background 0.15s; color: var(--text-primary); background: transparent; border: none;`;
        btn.onmousedown = (e) => e.preventDefault(); 
        btn.onmouseover = () => btn.style.backgroundColor = 'var(--hover-bg)';
        btn.onmouseout = () => btn.style.backgroundColor = 'transparent';
        btn.onclick = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); onClick(e, btn); };
        return btn;
    };

    const divider = () => {
        const d = document.createElement('div');
        d.style.cssText = `width: 1px; height: 16px; background: var(--border-color); margin: 0 2px;`;
        return d;
    };

    popupUI.appendChild(createBtn(ICONS.google, '', 'Искать в Google', () => {
        window.open('https://www.google.com/search?q=' + encodeURIComponent(currentSelection.text), '_blank');
        closePopup();
    }));
    popupUI.appendChild(divider());
    popupUI.appendChild(createBtn(ICONS.edit, 'Редактировать', 'Функции текста', () => {
        showAIMenu(lastAnchorX, lastAnchorY);
    }));
    popupUI.appendChild(divider());
    popupUI.appendChild(createBtn(ICONS.copy, '', 'Копировать', (e, btn) => {
        navigator.clipboard.writeText(currentSelection.text);
        btn.innerHTML = `<span style="display: flex; align-items: center; justify-content: center;">${ICONS.check}</span>`;
        setTimeout(() => closePopup(), 1000);
    }));
    popupUI.appendChild(divider());

    const moreWrap = document.createElement('div');
    moreWrap.id = 'gemini-more-btn-wrap';
    moreWrap.style.cssText = 'position: relative; display: flex; align-items: center;';

    const moreBtn = createBtn(ICONS.dots, '', 'Ещё опции', () => {
        const dropdown = document.getElementById('gemini-more-dropdown');
        if (dropdown) {
            if (dropdown.style.display === 'flex') {
                dropdown.style.display = 'none';
            } else {
                dropdown.style.display = 'flex';
                const rect = dropdown.getBoundingClientRect();
                if (rect.bottom > window.innerHeight - 10) {
                    dropdown.style.top = 'auto';
                    dropdown.style.bottom = '100%';
                    dropdown.style.marginTop = '0';
                    dropdown.style.marginBottom = '8px';
                } else {
                    dropdown.style.top = '100%';
                    dropdown.style.bottom = 'auto';
                    dropdown.style.marginTop = '8px';
                    dropdown.style.marginBottom = '0';
                }
            }
        }
    });
    moreWrap.appendChild(moreBtn);

    const moreDropdown = document.createElement('div');
    moreDropdown.id = 'gemini-more-dropdown';
    moreDropdown.style.cssText = `
        display: none; position: absolute; top: 100%; right: 0; margin-top: 8px;
        background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px;
        box-shadow: 0 16px 32px rgba(0,0,0,0.15); width: max-content; min-width: 120px; z-index: 9999;
        padding: 8px 0; flex-direction: column; overflow: hidden;
    `;

    const createDropdownItem = (icon: string, text: string, onClick: () => void) => {
        const item = document.createElement('div');
        item.innerHTML = `<span style="display:flex; align-items: center; justify-content: center; margin-right: 12px;">${icon}</span> <span style="font-weight: 500;">${text}</span>`;
        item.style.cssText = `padding: 10px 14px; font-size: 13px; cursor: pointer; display: flex; align-items: center; color: var(--text-primary); transition: background 0.15s; white-space: nowrap;`;
        item.onmousedown = (e) => e.preventDefault();
        item.onmouseover = () => item.style.backgroundColor = 'var(--hover-bg)';
        item.onmouseout = () => item.style.backgroundColor = 'transparent';
        item.onclick = (e) => {
            e.stopPropagation();
            moreDropdown.style.display = 'none';
            onClick();
        };
        return item;
    };

    moreDropdown.appendChild(createDropdownItem(ICONS.translate, 'Перевести', () => handleActionClick('translate')));
    moreDropdown.appendChild(createDropdownItem(ICONS.keyboard, 'Исправить раскладку', () => handleActionClick('layout')));
    moreDropdown.appendChild(createDropdownItem(ICONS.history, 'История', () => {
        chrome.runtime.sendMessage({ action: "openHistory" });
        closePopup();
    }));

    moreWrap.appendChild(moreDropdown);
    popupUI.appendChild(moreWrap);

    popupUI.appendChild(divider());
    popupUI.appendChild(createBtn(ICONS.closeColored, '', 'Закрыть', () => closePopup()));

    getPopupContainer().appendChild(popupUI);
    adjustPopupPosition();
}

function showAIMenu(x: number, y: number): void {
    closePopup();
    injectStyles();
    lastAnchorX = x;
    lastAnchorY = y;

    popupUI = document.createElement('div');
    popupUI.id = 'gemini-extension-ui';
    applyThemeToPopup(popupUI);

    popupUI.addEventListener('mousedown', e => e.stopPropagation());
    popupUI.addEventListener('mouseup', e => e.stopPropagation());
    popupUI.addEventListener('click', e => e.stopPropagation());

    popupUI.style.cssText = `
        position: fixed !important; left: -9999px; top: -9999px;
        background: var(--bg-primary);
        z-index: 2147483647 !important;
        font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
        color: var(--text-primary); width: max-content; min-width: 220px; 
        padding: 4px;
    `;

    const createMenuBtn = (icon: string, text: string, mode: string, shortcut?: string) => {
        const btn = document.createElement('button');
        btn.type = 'button'; 
        btn.innerHTML = `
            <div style="display: flex; align-items: center;">
                <span style="margin-right: 12px; display: flex; color: var(--text-secondary);">${icon}</span>
                <span style="font-weight: 500;">${text}</span>
            </div>
            ${shortcut ? `<span style="color: var(--text-secondary); font-size: 11px; margin-left: 24px; letter-spacing: 0.5px; opacity: 0.8;">${shortcut}</span>` : ''}
        `;
        btn.style.cssText = `width: 100%; padding: 8px 12px; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; justify-content: space-between; border-radius: 8px; color: var(--text-primary); background: transparent; border: none;`;
        btn.onmousedown = (e) => e.preventDefault();
        btn.onmouseover = () => btn.style.backgroundColor = 'var(--hover-bg)';
        btn.onmouseout = () => btn.style.backgroundColor = 'transparent';
        btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); handleActionClick(mode); };
        return btn;
    };

    popupUI.appendChild(createMenuBtn(ICONS.spell, 'Исправить ошибки', 'spellcheck', 'Alt+R'));
    popupUI.appendChild(createMenuBtn(ICONS.style, 'Переписать текст', 'style', 'Alt+Y'));
    popupUI.appendChild(createMenuBtn(ICONS.emoji, 'Подобрать эмодзи', 'emoji', 'Alt+T'));

    getPopupContainer().appendChild(popupUI);
    adjustPopupPosition();
}

function showRateLimitTimer(seconds: number, retryCallback: () => void, container: HTMLElement | null): void {
    let timeLeft = seconds;
    const render = () => {
        if (!container || !document.body.contains(container)) return false; 
        container.innerHTML = `
            <div style="padding: 16px; font-weight: 500; color: #b06000; display: flex; align-items: center; justify-content: center; gap: 10px; background: #fff8f0; border-radius: 12px; border: 1px solid #ffe8cc; margin: 4px;">
                <span class="gemini-hourglass">${ICONS.hourglass}</span>
                <span>Лимит. Автоповтор через <b>${timeLeft}</b> сек...</span>
            </div>
        `;
        adjustPopupPosition(); 
        return true;
    };
    
    if (!render()) return;
    
    const interval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(interval);
            if (container && document.body.contains(container)) retryCallback();
        } else {
            if (!render()) clearInterval(interval);
        }
    }, 1000);
}

function handleActionClick(mode: string): void {
    if (mode === 'translate') {
        const text = currentSelection.text || "";
        const ruCount = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
        const enCount = (text.match(/[a-zA-Z]/g) || []).length;
        currentTargetLang = (ruCount > 0 && ruCount >= enCount) ? "Английский" : "Русский";
    }
    executeRequest(mode);
}

function executeRequest(mode: string): void {
    if (!popupUI) return;
    popupUI.style.width = 'max-content';
    popupUI.style.padding = '0';
    popupUI.innerHTML = `<div style="padding: 10px 14px; font-weight: 500; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;"><div class="gemini-loader"></div>Обработка...</div>`;
    adjustPopupPosition(); 

    if (!chrome.runtime || !chrome.runtime.sendMessage) {
        popupUI.innerHTML = `<div style="padding: 10px 14px; color: #d32f2f;">Расширение обновлено (F5).</div>`;
        adjustPopupPosition();
        setTimeout(closePopup, 3000);
        return;
    }

    chrome.runtime.sendMessage({ 
        action: "callGemini", 
        text: currentSelection.text, 
        mode: mode, 
        targetLang: currentTargetLang
    }, (response: any) => {
        if (!popupUI) return;
        if (chrome.runtime.lastError) {
            popupUI.innerHTML = `<div style="padding: 10px 14px; color: #d32f2f;">Сбой связи (F5).</div>`;
            adjustPopupPosition();
            setTimeout(closePopup, 3000);
            return;
        }
        if (response && response.success) {
            showResultsMenu(response.data, mode);
        } else {
            const err = response ? response.error : 'Неизвестная ошибка';
            if (err.toLowerCase().includes('rate limit') || err.includes('429')) {
                showRateLimitTimer(5, () => executeRequest(mode), popupUI);
            } else {
                popupUI.innerHTML = `<div style="padding: 10px 14px; color: #d32f2f;">Ошибка: ${err}</div>`;
                adjustPopupPosition();
                setTimeout(closePopup, 3000);
            }
        }
    });
}

function showResultsMenu(options: any[], mode: string): void {
    if (!popupUI) return;
    popupUI.innerHTML = '';
    
    if (mode === "translate" || mode === "layout") {
        popupUI.style.width = '320px'; 
        popupUI.style.display = 'block';
        
        const header = document.createElement('div');
        header.style.cssText = 'padding: 12px 16px; font-size: 14px; font-weight: 600; color: var(--text-primary); border-bottom: 1px solid var(--border-color); background: transparent; display: flex; justify-content: space-between; align-items: center; position: relative; border-radius: 12px 12px 0 0;';
        
        if (mode === "translate") {
            const langWrap = document.createElement('div');
            langWrap.style.cssText = 'display: flex; align-items: center; gap: 4px; cursor: pointer; position: relative; user-select: none; padding: 6px 10px; margin-left: -10px; border-radius: 8px; transition: background 0.15s;';
            langWrap.innerHTML = `<span id="gemini-lang-label">${currentTargetLang}</span> <span style="margin-top:2px;">${ICONS.chevronDown}</span>`;
            langWrap.onmouseover = () => langWrap.style.background = 'var(--hover-bg)';
            langWrap.onmouseout = () => langWrap.style.background = 'transparent';
            
            const langDropdown = document.createElement('div');
            langDropdown.className = 'gemini-scroll';
            langDropdown.style.cssText = 'display: none; position: absolute; top: 100%; left: -4px; margin-top: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 12px 24px var(--shadow-color); flex-direction: column; min-width: 140px; z-index: 9999; padding: 8px 0; max-height: 220px; overflow-y: auto; cursor: default;';
            
            const popularLangs = ['Английский', 'Русский', 'Немецкий', 'Французский', 'Испанский', 'Итальянский', 'Польский', 'Китайский', 'Турецкий', 'Японский'];
            
            popularLangs.forEach(lang => {
                const langItem = document.createElement('div');
                langItem.textContent = lang;
                langItem.style.cssText = `padding: 10px 16px; font-size: 13px; cursor: pointer; transition: background 0.1s; color: var(--text-primary);`;
                langItem.onmousedown = (e) => e.preventDefault();

                if (lang === currentTargetLang) {
                    langItem.style.background = 'var(--hover-bg)';
                    langItem.style.fontWeight = '600';
                }
                langItem.onmouseover = () => { if(lang !== currentTargetLang) langItem.style.background = 'var(--hover-bg)'; };
                langItem.onmouseout = () => { if(lang !== currentTargetLang) langItem.style.background = 'transparent'; };
                langItem.onclick = (e) => {
                    e.stopPropagation();
                    langDropdown.style.display = 'none';
                    if (lang !== currentTargetLang) {
                        currentTargetLang = lang;
                        const label = document.getElementById('gemini-lang-label');
                        if (label) label.textContent = lang;
                        triggerInlineTranslation();
                    }
                };
                langDropdown.appendChild(langItem);
            });

            langWrap.appendChild(langDropdown);
            langWrap.onclick = (e) => {
                e.stopPropagation();
                langDropdown.style.display = langDropdown.style.display === 'flex' ? 'none' : 'flex';
            };
            header.appendChild(langWrap);
        } else {
            const layoutTitle = document.createElement('div');
            layoutTitle.innerHTML = `<span style="display:flex; align-items:center; gap:8px;">${ICONS.keyboard} Исправление раскладки</span>`;
            header.appendChild(layoutTitle);
        }
        
        const rightIcons = document.createElement('div');
        rightIcons.style.cssText = 'display: flex; align-items: center; gap: 12px; color: var(--text-secondary); margin-left: auto;';
        
        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = ICONS.closeStandard;
        closeBtn.style.cssText = 'cursor: pointer; display: flex; align-items: center; margin-right: -4px; padding: 6px; border-radius: 8px; transition: background 0.15s;';
        closeBtn.onmousedown = (e) => e.preventDefault();
        closeBtn.onmouseover = () => closeBtn.style.background = 'var(--hover-bg)';
        closeBtn.onmouseout = () => closeBtn.style.background = 'transparent';
        closeBtn.onclick = closePopup;
        
        rightIcons.appendChild(closeBtn);
        header.appendChild(rightIcons);
        popupUI.appendChild(header);

        const contentPane = document.createElement('div');
        contentPane.className = 'gemini-scroll';
        contentPane.style.cssText = 'padding: 16px; display: flex; flex-direction: column; gap: 16px; background: transparent; min-height: 80px; max-height: 50vh; overflow-y: auto; overflow-x: hidden;';
        popupUI.appendChild(contentPane);

        function renderTranslationContent(opts: any[]) {
            contentPane.innerHTML = '';
            const opt = opts[0]; 
            
            let parsedOpt = opt;
            if (typeof opt === 'string') {
                try { parsedOpt = JSON.parse(opt); } catch(e) {}
            }
            
            let displayText = parsedOpt;
            let insertText = parsedOpt;
            
            if (typeof parsedOpt === 'object' && parsedOpt !== null) {
                displayText = parsedOpt.html || parsedOpt.clean || parsedOpt.corrected_text || parsedOpt.text || parsedOpt.result || JSON.stringify(parsedOpt);
                insertText = parsedOpt.clean || parsedOpt.corrected_text || parsedOpt.text || parsedOpt.result || parsedOpt.html || JSON.stringify(parsedOpt);
            }
            
            const textContainer = document.createElement('div');
            textContainer.innerHTML = String(displayText);
            textContainer.style.cssText = 'word-wrap: break-word; white-space: pre-wrap; font-size: 14px; color: var(--text-primary); line-height: 1.6; font-family: system-ui, sans-serif;';
            contentPane.appendChild(textContainer);
            
            const actionsContainer = document.createElement('div');
            actionsContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 8px;';
            
            const replaceBtn = document.createElement('button');
            replaceBtn.type = 'button'; 
            replaceBtn.className = 'gemini-translate-btn';
            replaceBtn.innerHTML = `${ICONS.replaceCurved} Заменить текст`;
            replaceBtn.onmousedown = (e) => e.preventDefault();
            replaceBtn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                insertTextToDOM(String(insertText));
                closePopup();
            };
            
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button'; 
            copyBtn.className = 'gemini-translate-btn icon-only';
            copyBtn.innerHTML = ICONS.copyStandard;
            copyBtn.onmousedown = (e) => e.preventDefault();
            copyBtn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                navigator.clipboard.writeText(String(insertText));
                copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                setTimeout(() => copyBtn.innerHTML = ICONS.copyStandard, 1500);
            };
            
            actionsContainer.appendChild(replaceBtn);
            actionsContainer.appendChild(copyBtn);
            contentPane.appendChild(actionsContainer);
            adjustPopupPosition(); 
        }

        renderTranslationContent(options);

        function triggerInlineTranslation() {
            contentPane.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; padding: 24px 0; color: var(--text-secondary); gap: 10px;"><div class="gemini-loader"></div><span style="font-weight: 500;">Перевожу...</span></div>`;
            adjustPopupPosition(); 

            if (!chrome.runtime || !chrome.runtime.sendMessage) {
                contentPane.innerHTML = `<div style="padding: 16px; color: #d32f2f;">Расширение обновлено (F5).</div>`;
                adjustPopupPosition();
                return;
            }

            chrome.runtime.sendMessage({ action: "callGemini", text: currentSelection.text, mode: "translate", targetLang: currentTargetLang }, (response: any) => {
                if (response && response.success) {
                    renderTranslationContent(response.data);
                } else {
                    const err = response ? response.error : 'Ошибка связи';
                    if (err.toLowerCase().includes('rate limit') || err.includes('429')) {
                        showRateLimitTimer(5, triggerInlineTranslation, contentPane);
                    } else {
                        contentPane.innerHTML = `<div style="padding: 16px; color: #d32f2f;">Ошибка: ${err}</div>`;
                        adjustPopupPosition();
                    }
                }
            });
        }

    } else {
        popupUI.style.width = '320px'; 
        popupUI.style.display = 'block';
        
        const header = document.createElement('div');
        let headerText = 'Выберите вариант';
        if (mode === "emoji") headerText = `<span style="display:flex; align-items:center; gap:8px;">${ICONS.emoji} Варианты с эмодзи</span>`;
        
        header.innerHTML = headerText;
        header.style.cssText = 'padding: 12px 16px; font-size: 14px; font-weight: 600; color: var(--text-primary); border-bottom: 1px solid var(--border-color); background: transparent; display: flex; justify-content: space-between; align-items: center; border-radius: 12px 12px 0 0;';
        
        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = ICONS.closeStandard;
        closeBtn.style.cssText = 'cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; padding: 6px; border-radius: 8px; transition: background 0.15s;';
        closeBtn.onmousedown = (e) => e.preventDefault();
        closeBtn.onmouseover = () => closeBtn.style.background = 'var(--hover-bg)';
        closeBtn.onmouseout = () => closeBtn.style.background = 'transparent';
        closeBtn.onclick = closePopup;
        header.appendChild(closeBtn);
        popupUI.appendChild(header);

        const itemsWrapper = document.createElement('div');
        itemsWrapper.className = 'gemini-scroll';
        itemsWrapper.style.cssText = 'max-height: 50vh; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; background: transparent;';

        options.forEach((opt: any, index: number) => {
            const item = document.createElement('div');
            item.style.cssText = `padding: 16px; border-bottom: ${index < options.length - 1 ? '1px solid var(--border-color)' : 'none'};`;
            
            let parsedOpt = opt;
            if (typeof opt === 'string') {
                try { parsedOpt = JSON.parse(opt); } catch(e) {}
            }
            
            let displayText = parsedOpt;
            let cleanText = parsedOpt;
            
            if (typeof parsedOpt === 'object' && parsedOpt !== null) {
                displayText = parsedOpt.html || parsedOpt.clean || parsedOpt.corrected_text || parsedOpt.response || parsedOpt.text || parsedOpt.result || JSON.stringify(parsedOpt);
                cleanText = parsedOpt.clean || parsedOpt.corrected_text || parsedOpt.response || parsedOpt.text || parsedOpt.result || parsedOpt.html || JSON.stringify(parsedOpt);
            }
            
            const textContainer = document.createElement('div');
            textContainer.innerHTML = String(displayText);
            textContainer.style.cssText = `word-wrap: break-word; white-space: pre-wrap; margin-bottom: 14px; color: var(--text-primary); line-height: 1.6;`;
            item.appendChild(textContainer);

            const actionsContainer = document.createElement('div');
            actionsContainer.style.cssText = `display: flex; gap: 10px;`;

            const replaceBtn = document.createElement('button');
            replaceBtn.type = 'button'; 
            replaceBtn.className = 'gemini-btn-action';
            replaceBtn.innerHTML = `${ICONS.replace} Заменить`;
            replaceBtn.onmousedown = (e) => e.preventDefault();
            replaceBtn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                insertTextToDOM(String(cleanText));
                closePopup();
            };

            const copyBtn = document.createElement('button');
            copyBtn.type = 'button'; 
            copyBtn.className = 'gemini-btn-action';
            copyBtn.innerHTML = ICONS.copy;
            copyBtn.onmousedown = (e) => e.preventDefault();
            copyBtn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                navigator.clipboard.writeText(String(cleanText));
                copyBtn.innerHTML = ICONS.check;
                setTimeout(() => copyBtn.innerHTML = ICONS.copy, 1500); 
            };

            actionsContainer.appendChild(replaceBtn);
            actionsContainer.appendChild(copyBtn);
            item.appendChild(actionsContainer);
            itemsWrapper.appendChild(item);
        });
        
        popupUI.appendChild(itemsWrapper);
        adjustPopupPosition(); 
    }
}

function adjustPopupPosition(): void {
    if (!popupUI) return;

    const rect = popupUI.getBoundingClientRect();
    let absoluteLeft = lastAnchorX;
    let absoluteTop = lastAnchorY + 6; 
    
    let viewportX = absoluteLeft;
    let viewportY = absoluteTop;

    if (viewportX + rect.width > window.innerWidth - 20) {
        viewportX = window.innerWidth - rect.width - 20;
    }
    if (viewportX < 20) viewportX = 20;

    if (viewportY + rect.height > window.innerHeight - 20) {
        viewportY = lastAnchorY - rect.height - 6; 
    }

    if (viewportY < 20) {
        viewportY = 20;
    }

    popupUI.style.left = `${viewportX}px`;
    popupUI.style.top = `${viewportY}px`;
}

function insertTextToDOM(newText: string): void {
    const { isInput, activeElement, start, end, range } = currentSelection;
    try {
        if (isInput && activeElement) {
            const val = activeElement.value;
            const safeStart = start || 0;
            const safeEnd = end || 0;
            const newFullText = val.substring(0, safeStart) + newText + val.substring(safeEnd);
            
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
            
            if (activeElement.tagName === 'INPUT' && nativeInputValueSetter) {
                nativeInputValueSetter.call(activeElement, newFullText);
            } else if (activeElement.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
                nativeTextAreaValueSetter.call(activeElement, newFullText);
            } else {
                activeElement.value = newFullText;
            }

            activeElement.selectionStart = activeElement.selectionEnd = safeStart + newText.length;
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            activeElement.dispatchEvent(new Event('change', { bubbles: true }));
            
        } else if (range) {
            
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range); 
            }

            const success = document.execCommand('insertText', false, newText);

            if (!success && sel) {
                range.deleteContents();
                const textNode = document.createTextNode(newText);
                range.insertNode(textNode);
                
                sel.removeAllRanges();
                const newRange = document.createRange();
                newRange.setStartAfter(textNode);
                newRange.setEndAfter(textNode);
                sel.addRange(newRange);
            }
            
            if (activeElement) {
                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                activeElement.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    } catch (err) {
        console.error("Ошибка вставки:", err);
    }
}

function closePopup(): void {
    if (popupUI) {
        const el = popupUI;
        popupUI = null; 
        
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        
        setTimeout(() => {
            if (el && el.parentNode) {
                el.remove();
            }
        }, 150);
    }
}