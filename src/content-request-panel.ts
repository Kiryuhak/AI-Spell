import { ICONS } from './icons';
import { getCachedText, getCacheHash, setCachedText } from './ai-cache';
import { t } from './i18n';
import { addHistoryItem, updateHistoryItemResult } from './history-store';
import { isSiteDisabled, normalizeDisabledSites, shouldStoreOnCurrentPage } from './privacy';
import {
    getWordCorrections,
    normalizeSpellcheckResult,
    renderSpellcheckDiffFragment,
    resolveCorrections,
    type WordCorrection,
} from './spellcheck';
import { replaceSelectedText } from './text-replacement';
import type { CustomCommand, HistoryItem, RequestMode, SelectionData, StreamResponse } from './types';
import { recordCacheHit } from './usage-stats';
import { appendIconAndText, createSvgIcon, renderMarkdown, setIcon } from './dom-rendering';
import { REQUEST_CACHE_VERSION, serializeCacheSource } from './request-cache';

export interface ContentRequestContext {
    getPopup: () => HTMLElement | null;
    getSelection: () => SelectionData;
    getTargetLanguage: () => string;
    setTargetLanguage: (language: string) => void;
    getLanguageName: (code: string) => string;
    getPopupElementById: <T extends HTMLElement>(id: string) => T | null;
    adjustPopupPosition: () => void;
    closePopup: () => void;
    startDragging: (offsetX: number, offsetY: number) => void;
}

export function handleActionClick(mode: RequestMode, context: ContentRequestContext): void {
    if (mode === 'translate') {
        const text = context.getSelection().text || '';
        const ruCount = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
        const enCount = (text.match(/[a-zA-Z]/g) || []).length;
        const targetLanguage =
            ruCount > 0 && ruCount >= enCount ? context.getLanguageName('en') : context.getLanguageName('ru');
        context.setTargetLanguage(targetLanguage);
    }
    executeRequest(mode, undefined, context);
}

export function executeRequest(
    mode: RequestMode,
    customCommand: CustomCommand | undefined,
    context: ContentRequestContext,
): void {
    const popupUI = context.getPopup();
    if (!popupUI) return;
    const currentSelection = context.getSelection();
    let currentTargetLang = context.getTargetLanguage();
    const { getLanguageName, getPopupElementById, adjustPopupPosition, closePopup } = context;
    const originalText = currentSelection.text;

    function showRateLimitTimer(seconds: number, retryCallback: () => void, container: HTMLElement | null): void {
        let timeLeft = seconds;
        const render = () => {
            if (!container || !container.isConnected) return false;
            const message = document.createElement('div');
            message.style.cssText =
                'padding:16px;font-weight:500;color:#b06000;display:flex;align-items:center;justify-content:center;gap:10px;background:#fff8f0;border-radius:12px;border:1px solid #ffe8cc;margin:4px;';
            const icon = document.createElement('span');
            icon.className = 'lexisync-hourglass';
            setIcon(icon, ICONS.hourglass);
            const copy = document.createElement('span');
            copy.append(
                document.createTextNode(`${t('rateLimitRetry', 'Лимит. Автоповтор через')} `),
                Object.assign(document.createElement('b'), { textContent: String(timeLeft) }),
                document.createTextNode(` ${t('seconds', 'сек…')}`),
            );
            message.append(icon, copy);
            container.replaceChildren(message);
            adjustPopupPosition();
            return true;
        };
        if (!render()) return;
        const interval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(interval);
                if (container && container.isConnected) retryCallback();
            } else if (!render()) {
                clearInterval(interval);
            }
        }, 1000);
    }

    popupUI.dataset.surface = 'result';
    popupUI.setAttribute('role', 'dialog');
    popupUI.setAttribute('aria-label', t('resultDialog', 'Результат обработки текста'));
    popupUI.style.width = '340px';
    popupUI.style.padding = '0';
    popupUI.style.display = 'block';

    let headerLabel = '';
    let headerIcon = '';
    let headerEmoji = '';
    if (mode === 'spellcheck') headerLabel = t('spellcheckDone', 'Ошибки исправлены');
    else if (mode === 'style') {
        headerIcon = ICONS.style;
        headerLabel = t('styleChanged', 'Стиль изменён');
    } else if (mode === 'emoji') {
        headerIcon = ICONS.emoji;
        headerLabel = t('emojiVariants', 'Варианты с эмодзи');
    } else if (mode === 'layout') {
        headerIcon = ICONS.keyboard;
        headerLabel = t('layoutFixed', 'Раскладка исправлена');
    } else if (mode === 'translate') headerLabel = t('translation', 'Перевод');
    else if (mode === 'ocr') {
        headerEmoji = '📸';
        headerLabel = t('ocrResult', 'Распознанный текст');
    } else if (mode === 'custom') {
        headerIcon = ICONS.style;
        headerLabel = customCommand?.name || t('myCommand', 'Моя команда');
    }

    const header = document.createElement('div');
    header.className = 'lexisync-header';
    header.style.cssText =
        'padding: 12px 16px; font-size: 14px; color: var(--text-primary); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; border-radius: 12px 12px 0 0; background: transparent; cursor: grab; user-select: none;';

    header.onmousedown = (e) => {
        const target = e.target as HTMLElement;
        if (
            target.closest('svg') ||
            target.closest('div[style*="cursor: pointer"]') ||
            target.closest('#lexisync-lang-label')
        )
            return;
        header.style.cursor = 'grabbing';
        const rect = popupUI.getBoundingClientRect();
        context.startDragging(e.clientX - rect.left, e.clientY - rect.top);
        e.preventDefault();
    };

    const headerTitleWrapper = document.createElement('div');
    headerTitleWrapper.className = 'lexisync-header-title';
    headerTitleWrapper.style.cssText =
        'display: flex; align-items: center; gap: 8px; font-weight: 600; pointer-events: none;';

    if (mode === 'translate') {
        headerTitleWrapper.style.pointerEvents = 'auto';
        const langWrap = document.createElement('div');
        langWrap.style.cssText =
            'display: flex; align-items: center; gap: 4px; cursor: pointer; position: relative; user-select: none; padding: 6px 10px; margin-left: -10px; border-radius: 8px; transition: background 0.15s;';
        const languageLabel = document.createElement('span');
        languageLabel.id = 'lexisync-lang-label';
        languageLabel.textContent = currentTargetLang;
        const chevron = document.createElement('span');
        chevron.style.marginTop = '2px';
        setIcon(chevron, ICONS.chevronDown);
        langWrap.append(languageLabel, chevron);
        langWrap.onmouseover = () => (langWrap.style.background = 'var(--hover-bg)');
        langWrap.onmouseout = () => (langWrap.style.background = 'transparent');

        const langDropdown = document.createElement('div');
        langDropdown.className = 'lexisync-scroll';
        langDropdown.style.cssText =
            'display: none; position: absolute; top: 100%; left: -4px; margin-top: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 12px 24px var(--shadow-color); flex-direction: column; min-width: 140px; z-index: 9999; padding: 8px 0; max-height: 220px; overflow-y: auto; font-weight: normal;';

        const popularLangs = ['en', 'ru', 'de', 'fr', 'es', 'it', 'pl', 'zh', 'tr', 'ja'].map(getLanguageName);

        popularLangs.forEach((lang) => {
            const langItem = document.createElement('div');
            langItem.textContent = lang;
            langItem.style.cssText = `padding: 10px 16px; font-size: 13px; cursor: pointer; transition: background 0.1s; color: var(--text-primary);`;
            if (lang === currentTargetLang) {
                langItem.style.background = 'var(--hover-bg)';
                langItem.style.fontWeight = '600';
            }
            langItem.onmouseover = () => {
                if (lang !== currentTargetLang) langItem.style.background = 'var(--hover-bg)';
            };
            langItem.onmouseout = () => {
                if (lang !== currentTargetLang) langItem.style.background = 'transparent';
            };
            langItem.onclick = (e) => {
                e.stopPropagation();
                langDropdown.style.display = 'none';
                if (lang !== currentTargetLang) {
                    currentTargetLang = lang;
                    context.setTargetLanguage(lang);
                    const languageLabel = getPopupElementById<HTMLElement>('lexisync-lang-label');
                    if (languageLabel) languageLabel.textContent = lang;
                    if (streamPort) streamPort.disconnect();
                    startStream();
                }
            };
            langDropdown.appendChild(langItem);
        });

        langWrap.appendChild(langDropdown);
        langWrap.onclick = (e) => {
            e.stopPropagation();
            langDropdown.style.display = langDropdown.style.display === 'flex' ? 'none' : 'flex';
        };
        headerTitleWrapper.appendChild(langWrap);
    } else {
        if (headerIcon) headerTitleWrapper.appendChild(createSvgIcon(headerIcon));
        if (headerEmoji) headerTitleWrapper.appendChild(document.createTextNode(headerEmoji));
        headerTitleWrapper.appendChild(document.createTextNode(headerLabel));
    }

    const loaderOrClose = document.createElement('div');
    const initialLoader = document.createElement('div');
    initialLoader.className = 'lexisync-loader';
    loaderOrClose.appendChild(initialLoader);

    header.appendChild(headerTitleWrapper);
    header.appendChild(loaderOrClose);

    const contentPane = document.createElement('div');
    contentPane.className = 'lexisync-scroll lexisync-content-pane';
    contentPane.style.cssText =
        'padding: 16px; min-height: 50px; max-height: 50vh; overflow-y: auto; overflow-x: hidden; font-size: 14px; color: var(--text-primary); line-height: 1.6; font-family: system-ui, sans-serif; word-wrap: break-word; white-space: pre-wrap;';

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'lexisync-actions';
    actionsContainer.style.cssText =
        'display: none; padding: 0 16px 16px 16px; gap: 10px; align-items: center; justify-content: flex-start;';

    const correctionsContainer = document.createElement('div');
    correctionsContainer.className = 'lexisync-corrections';
    correctionsContainer.style.cssText = 'display:none; padding:0 16px 12px; gap:6px; flex-direction:column;';

    const resultTools = document.createElement('div');
    resultTools.className = 'lexisync-result-tools';

    popupUI.replaceChildren();
    popupUI.appendChild(header);
    popupUI.appendChild(contentPane);
    popupUI.appendChild(correctionsContainer);
    popupUI.appendChild(resultTools);
    popupUI.appendChild(actionsContainer);
    adjustPopupPosition();

    let fullResult = '';
    let comparisonOriginalVisible = false;
    let editedResultSnapshot = '';
    let streamPort: chrome.runtime.Port | null = null;
    let usePageContext = false;
    let storageAllowed = false;
    let cacheSettingsFingerprint = 'default';
    let savedHistoryId: number | null = null;
    let wordCorrections: WordCorrection[] = [];
    const rejectedCorrections = new Set<number>();

    function getCacheSource(): string {
        return serializeCacheSource({
            text: currentSelection.text,
            context: usePageContext ? currentSelection.context : '',
            pageTitle: usePageContext ? document.title : '',
            pageOrigin: usePageContext ? location.origin : '',
            customPrompt: customCommand?.prompt || '',
        });
    }

    function getEffectiveResult(): string {
        if (comparisonOriginalVisible && editedResultSnapshot) return editedResultSnapshot;
        if (contentPane.contentEditable === 'true') return contentPane.innerText.trim();
        const clean = fullResult.replace(/\*/g, '');
        return mode === 'spellcheck' ? resolveCorrections(clean, wordCorrections, rejectedCorrections) : clean;
    }

    function refreshSpellcheck(): void {
        if (mode !== 'spellcheck') return;
        contentPane.replaceChildren(
            renderSpellcheckDiffFragment(currentSelection.text, fullResult, rejectedCorrections),
        );
        renderCorrectionControls();
    }

    async function addToDictionary(word: string): Promise<void> {
        const data = await chrome.storage.local.get({ personalDictionary: [] });
        const dictionary = Array.isArray(data.personalDictionary) ? data.personalDictionary.map(String) : [];
        if (!dictionary.some((item) => item.toLocaleLowerCase('ru-RU') === word.toLocaleLowerCase('ru-RU'))) {
            dictionary.push(word);
            await chrome.storage.local.set({ personalDictionary: dictionary.sort((a, b) => a.localeCompare(b, 'ru')) });
        }
    }

    function toggleCorrection(correction: WordCorrection): void {
        if (rejectedCorrections.has(correction.tokenIndex)) rejectedCorrections.delete(correction.tokenIndex);
        else rejectedCorrections.add(correction.tokenIndex);
        refreshSpellcheck();
        if (storageAllowed && savedHistoryId !== null) {
            void updateHistoryItemResult(savedHistoryId, getEffectiveResult());
        }
    }

    function renderCorrectionControls(): void {
        correctionsContainer.replaceChildren();
        correctionsContainer.style.display = wordCorrections.length > 0 ? 'flex' : 'none';
        for (const correction of wordCorrections) {
            const row = document.createElement('div');
            row.className = 'lexisync-correction-row';
            row.style.cssText =
                'display:flex; align-items:center; gap:7px; padding:7px 9px; border:1px solid var(--border-color); border-radius:8px; font-size:12px;';
            const label = document.createElement('span');
            label.style.cssText = 'flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            label.textContent = `${correction.original.trim() || '∅'} → ${correction.corrected.trim() || '∅'}`;
            const choice = document.createElement('button');
            choice.type = 'button';
            choice.textContent = rejectedCorrections.has(correction.tokenIndex)
                ? t('restoreCorrection', 'Вернуть')
                : t('correctionAccepted', 'Принято');
            choice.title = rejectedCorrections.has(correction.tokenIndex)
                ? t('acceptAgain', 'Снова принять исправление')
                : t('keepOriginal', 'Оставить исходное слово');
            choice.style.cssText =
                'border:0; border-radius:6px; padding:5px 7px; cursor:pointer; background:var(--bg-secondary); color:var(--text-primary);';
            choice.onclick = () => toggleCorrection(correction);
            const dictionary = document.createElement('button');
            dictionary.type = 'button';
            dictionary.textContent = t('addDictionary', '+ Словарь');
            dictionary.title = t('dictionaryFuture', 'Не исправлять это слово в будущем');
            dictionary.style.cssText = choice.style.cssText;
            dictionary.onclick = async () => {
                await addToDictionary(correction.original.trim());
                rejectedCorrections.add(correction.tokenIndex);
                dictionary.textContent = t('added', 'Добавлено');
                dictionary.disabled = true;
                refreshSpellcheck();
                if (storageAllowed && savedHistoryId !== null) {
                    void updateHistoryItemResult(savedHistoryId, getEffectiveResult());
                }
            };
            dictionary.hidden = !/^[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*$/u.test(correction.original.trim());
            row.append(label, choice, dictionary);
            correctionsContainer.appendChild(row);
        }
    }

    contentPane.addEventListener('click', (event) => {
        const mark = (event.target as HTMLElement).closest('mark[data-token-index]') as HTMLElement | null;
        const tokenIndex = Number(mark?.dataset.tokenIndex);
        const correction = wordCorrections.find((item) => item.tokenIndex === tokenIndex);
        if (correction) toggleCorrection(correction);
    });
    contentPane.addEventListener('input', () => {
        if (storageAllowed && savedHistoryId !== null && contentPane.contentEditable === 'true') {
            void updateHistoryItemResult(savedHistoryId, getEffectiveResult());
        }
    });

    function renderLoadingControl(): void {
        loaderOrClose.replaceChildren();
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex; align-items:center; gap:8px;';
        const loader = document.createElement('div');
        loader.className = 'lexisync-loader';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'lexisync-cancel-button';
        cancelBtn.title = t('cancelRequest', 'Отменить запрос');
        cancelBtn.setAttribute('aria-label', t('cancelRequest', 'Отменить запрос'));
        setIcon(cancelBtn, ICONS.closeStandard);
        cancelBtn.style.cssText =
            'display:flex; align-items:center; justify-content:center; padding:4px; border:0; border-radius:6px; background:transparent; color:var(--text-secondary); cursor:pointer;';
        cancelBtn.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            cancelBtn.disabled = true;
            contentPane.textContent = t('cancelling', 'Отменяем запрос…');
            streamPort?.postMessage({ action: 'cancelMistral' });
        };
        wrapper.append(loader, cancelBtn);
        loaderOrClose.appendChild(wrapper);
    }

    function startStream() {
        streamPort?.disconnect();
        streamPort = null;
        fullResult = '';
        comparisonOriginalVisible = false;
        editedResultSnapshot = '';
        contentPane.contentEditable = 'false';
        contentPane.removeAttribute('contenteditable');
        resultTools.style.display = 'none';
        const skeleton = document.createElement('div');
        skeleton.className = 'lexisync-skeleton';
        skeleton.setAttribute('role', 'status');
        skeleton.setAttribute('aria-label', t('processing', 'LexiSync обрабатывает текст'));
        for (let index = 0; index < 3; index++) {
            const line = document.createElement('span');
            line.className = 'lexisync-skeleton-line';
            skeleton.appendChild(line);
        }
        contentPane.replaceChildren(skeleton);
        contentPane.style.color = '';
        actionsContainer.style.display = 'none';
        renderLoadingControl();

        if (!navigator.onLine && mode !== 'layout') {
            contentPane.textContent = t(
                'offlineError',
                'Нет подключения к интернету. Проверьте сеть и попробуйте снова.',
            );
            contentPane.style.color = '#d32f2f';
            finishStream(false);
            return;
        }

        if (currentSelection.text.length > 3000) {
            contentPane.textContent = t(
                'textTooLong',
                'Текст слишком длинный. Выделите не более 3000 символов за раз.',
            );
            contentPane.style.color = '#d32f2f';
            finishStream(false);
            return;
        }

        if (!chrome.runtime || !chrome.runtime.connect) {
            contentPane.textContent = t('reloadPage', 'Пожалуйста, обновите страницу (F5).');
            contentPane.style.color = '#d32f2f';
            return;
        }

        streamPort = chrome.runtime.connect({ name: 'mistralStream' });
        streamPort.postMessage({
            action: 'callMistral',
            text: currentSelection.text,
            context: currentSelection.context,
            mode: mode,
            targetLang: currentTargetLang,
            pageTitle: document.title,
            pageUrl: window.location.hostname,
            allowPageContext: usePageContext,
            customPrompt: customCommand?.prompt,
            imageUrl: currentSelection.imageUrl, // 🔥 НОВОЕ
        });
        streamPort.onMessage.addListener((response: StreamResponse) => {
            if (response.status === 'chunk') {
                fullResult += response.text;
                renderMarkdown(contentPane, fullResult);
                contentPane.setAttribute('aria-live', 'polite');
                contentPane.scrollTop = contentPane.scrollHeight;
                adjustPopupPosition();
            } else if (response.status === 'done') {
                if (mode === 'spellcheck') {
                    fullResult = normalizeSpellcheckResult(fullResult);
                    wordCorrections = getWordCorrections(currentSelection.text, fullResult);
                    refreshSpellcheck();
                } else {
                    renderMarkdown(contentPane, fullResult);
                }
                contentPane.removeAttribute('aria-live');
                finishStream();

                const historyItem: HistoryItem = {
                    id: Date.now(),
                    mode,
                    original: currentSelection.text,
                    result: getEffectiveResult(),
                    date: new Date().toISOString(),
                    customName: customCommand?.name,
                };

                if (storageAllowed) {
                    const baseCacheMode =
                        mode === 'translate'
                            ? mode + currentTargetLang
                            : mode === 'custom'
                              ? `custom:${customCommand?.id || 'unknown'}`
                              : mode;
                    const cacheModeKey = `v${REQUEST_CACHE_VERSION}:${baseCacheMode}:${cacheSettingsFingerprint}`;
                    void getCacheHash(cacheModeKey, getCacheSource())
                        .then((cacheKey) => setCachedText(cacheKey, fullResult))
                        .catch((error) => console.error('Ошибка сохранения кэша:', error));
                    void addHistoryItem(historyItem).then(async () => {
                        savedHistoryId = historyItem.id;
                        await updateHistoryItemResult(historyItem.id, getEffectiveResult());
                    });
                }
            } else if (response.status === 'error') {
                const errorMessage =
                    typeof response.error === 'string' ? response.error : t('unknownError', 'Неизвестная ошибка.');
                if (
                    errorMessage.toLowerCase().includes('rate limit') ||
                    errorMessage.toLowerCase().includes('лимит') ||
                    errorMessage.includes('429')
                ) {
                    showRateLimitTimer(5, startStream, contentPane);
                } else {
                    contentPane.textContent = `${t('errorPrefix', 'Ошибка:')} ${errorMessage}`;
                    contentPane.style.color = '#d32f2f';
                }
                finishStream(false);
            } else if (response.status === 'cancelled') {
                contentPane.textContent = t('requestCancelled', 'Запрос отменён.');
                contentPane.style.color = 'var(--text-secondary)';
                finishStream(false);
            }
        });
    }

    function finishStream(success = true) {
        streamPort?.disconnect();
        streamPort = null;
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'lexisync-close-button';
        closeBtn.setAttribute('aria-label', t('closePanel', 'Закрыть панель'));
        setIcon(closeBtn, ICONS.closeStandard);
        closeBtn.style.cssText =
            'cursor: pointer; display: flex; align-items: center; margin-right: -4px; padding: 6px; border-radius: 8px; color: var(--text-secondary); transition: background 0.15s;';
        closeBtn.onmouseover = () => (closeBtn.style.background = 'var(--hover-bg)');
        closeBtn.onmouseout = () => (closeBtn.style.background = 'transparent');
        closeBtn.onclick = closePopup;
        loaderOrClose.replaceChildren();
        loaderOrClose.appendChild(closeBtn);

        if (success && fullResult.trim().length > 0) {
            if (mode !== 'spellcheck' && mode !== 'ocr') {
                contentPane.contentEditable = 'true';
                contentPane.setAttribute('aria-label', t('editableResult', 'Результат можно редактировать'));
                resultTools.style.display = 'flex';
                editedResultSnapshot = getEffectiveResult();
                const createTool = (label: string, action: () => void): HTMLButtonElement => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'lexisync-tool-chip';
                    button.textContent = label;
                    button.onclick = action;
                    return button;
                };
                const compareButton = createTool(t('beforeAfter', 'До / После'), () => {
                    if (!comparisonOriginalVisible) {
                        editedResultSnapshot = getEffectiveResult();
                        contentPane.contentEditable = 'false';
                        contentPane.textContent = originalText;
                        compareButton.textContent = t('showResult', 'Показать результат');
                    } else {
                        contentPane.textContent = editedResultSnapshot;
                        contentPane.contentEditable = 'true';
                        compareButton.textContent = t('beforeAfter', 'До / После');
                    }
                    comparisonOriginalVisible = !comparisonOriginalVisible;
                });
                const refine = (name: string, prompt: string) => {
                    const source = getEffectiveResult();
                    currentSelection.text = source;
                    currentSelection.context = source;
                    executeRequest('custom', { id: `refine-${name}`, name, prompt }, context);
                };
                resultTools.replaceChildren(
                    compareButton,
                    createTool(t('repeat', 'Повторить'), () => executeRequest(mode, customCommand, context)),
                    createTool(t('shorter', 'Короче'), () =>
                        refine(
                            t('refineShortName', 'Сделать короче'),
                            t('presetShortPrompt', 'Сократи текст, сохранив ключевые факты и исходный смысл.'),
                        ),
                    ),
                    createTool(t('longer', 'Подробнее'), () =>
                        refine(
                            t('refineLongName', 'Сделать подробнее'),
                            t(
                                'refineLongPrompt',
                                'Раскрой текст подробнее, добавив полезные пояснения без лишней воды.',
                            ),
                        ),
                    ),
                    createTool(t('moreFormal', 'Формальнее'), () =>
                        refine(
                            t('refineFormalName', 'Сделать формальнее'),
                            t('refineFormalPrompt', 'Перепиши текст в более формальном и профессиональном стиле.'),
                        ),
                    ),
                );
            }
            actionsContainer.style.display = 'flex';
            actionsContainer.replaceChildren();

            const btnClass =
                mode === 'translate' || mode === 'layout' ? 'lexisync-translate-btn' : 'lexisync-btn-action';
            const replaceIcon = mode === 'translate' || mode === 'layout' ? ICONS.replaceCurved : ICONS.replace;
            const copyIcon = mode === 'translate' || mode === 'layout' ? ICONS.copyStandard : ICONS.copy;

            const replaceBtn = document.createElement('button');
            replaceBtn.type = 'button';
            replaceBtn.className = `${btnClass} lexisync-result-button lexisync-result-button--primary`;
            appendIconAndText(replaceBtn, replaceIcon, t('replaceText', 'Заменить текст'));
            // ✅ НОВАЯ ЛОГИКА (ВСТАВИТЬ)
            replaceBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const undo = replaceSelectedText(currentSelection, getEffectiveResult());

                // Делаем красивую анимацию кнопки
                appendIconAndText(replaceBtn, ICONS.check, t('replaced', 'Заменено!'));
                replaceBtn.classList.add('lexisync-result-button--success');
                replaceBtn.style.backgroundColor = '#dcfce7';
                replaceBtn.style.color = '#166534';
                replaceBtn.style.fontWeight = '600';

                if (undo) {
                    const undoBtn = document.createElement('button');
                    undoBtn.type = 'button';
                    undoBtn.className = `${btnClass} lexisync-result-button`;
                    undoBtn.textContent = t('undoReplacement', 'Отменить замену');
                    undoBtn.onclick = () => {
                        undo();
                        undoBtn.remove();
                        replaceBtn.disabled = false;
                        replaceBtn.classList.remove('lexisync-result-button--success');
                        appendIconAndText(replaceBtn, replaceIcon, t('replaceText', 'Заменить текст'));
                    };
                    actionsContainer.appendChild(undoBtn);
                }
                replaceBtn.disabled = true;
            };

            if (mode === 'ocr') {
                navigator.clipboard.writeText(getEffectiveResult());
                const copied = document.createElement('span');
                copied.style.cssText = 'display:flex;align-items:center;gap:8px;color:#166534;';
                appendIconAndText(copied, ICONS.check, t('copied', 'Текст скопирован!'));
                headerTitleWrapper.replaceChildren(copied);
            }

            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = `${btnClass} lexisync-result-button icon-only`;
            copyBtn.setAttribute('aria-label', t('copy', 'Копировать'));
            setIcon(copyBtn, copyIcon);
            copyBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(getEffectiveResult());
                setIcon(copyBtn, ICONS.check);
                setTimeout(() => setIcon(copyBtn, copyIcon), 1500);
            };

            actionsContainer.appendChild(replaceBtn);
            actionsContainer.appendChild(copyBtn);
        }
        adjustPopupPosition();
    }

    async function checkCacheAndRun() {
        const res = (await chrome.runtime.sendMessage({ action: 'getRuntimeSettings' })) as {
            hasApiKey?: boolean;
            sendPageContext?: boolean;
            contextDisabledSites?: unknown;
            cacheFingerprint?: string;
        };
        usePageContext =
            res.sendPageContext === true &&
            !isSiteDisabled(location.hostname, normalizeDisabledSites(res.contextDisabledSites));
        cacheSettingsFingerprint = res.cacheFingerprint || 'default';
        storageAllowed = await shouldStoreOnCurrentPage();
        if (!res.hasApiKey && mode !== 'layout') {
            const emptyState = document.createElement('div');
            emptyState.style.cssText = 'text-align:center;padding:24px 16px;';
            const keyIcon = document.createElement('span');
            keyIcon.style.cssText = 'font-size:32px;display:block;margin-bottom:12px;';
            keyIcon.textContent = '🔑';
            const title = document.createElement('div');
            title.style.cssText = 'font-weight:600;font-size:16px;margin-bottom:8px;';
            title.textContent = t('apiKeyMissing', 'API-ключ не настроен');
            const countdown = document.createElement('div');
            countdown.style.cssText = 'color:var(--text-secondary);margin-bottom:16px;font-size:13px;';
            const timerSpan = document.createElement('span');
            timerSpan.id = 'redirectTimer';
            timerSpan.style.cssText = 'font-weight:bold;color:var(--primary);';
            timerSpan.textContent = '3';
            countdown.append(
                document.createTextNode(`${t('openingSettings', 'Открываем настройки через')} `),
                timerSpan,
                document.createTextNode('…'),
            );
            const openButton = document.createElement('button');
            openButton.id = 'openSettingsBtn';
            openButton.type = 'button';
            openButton.style.cssText =
                'background:var(--primary);color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:500;';
            openButton.textContent = t('openSettingsNow', 'Открыть сейчас');
            emptyState.append(keyIcon, title, countdown, openButton);
            contentPane.replaceChildren(emptyState);

            let timeLeft = 3;
            const interval = setInterval(() => {
                timeLeft--;
                if (timerSpan) timerSpan.textContent = timeLeft.toString();
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    chrome.runtime.sendMessage({ action: 'openOptionsPage' });
                    closePopup();
                }
            }, 1000);

            openButton.addEventListener('click', () => {
                clearInterval(interval);
                chrome.runtime.sendMessage({ action: 'openOptionsPage' });
                closePopup();
            });
            return;
        }

        if (mode === 'ocr') {
            startStream();
            return;
        }

        const baseCacheMode =
            mode === 'translate'
                ? mode + currentTargetLang
                : mode === 'custom'
                  ? `custom:${customCommand?.id || 'unknown'}`
                  : mode;
        const cacheModeKey = `v${REQUEST_CACHE_VERSION}:${baseCacheMode}:${cacheSettingsFingerprint}`;
        const cacheKey = await getCacheHash(cacheModeKey, getCacheSource());
        const cachedResult = storageAllowed ? await getCachedText(cacheKey) : null;
        if (cachedResult) {
            void recordCacheHit();
            fullResult = mode === 'spellcheck' ? normalizeSpellcheckResult(cachedResult) : cachedResult;
            if (mode === 'spellcheck') wordCorrections = getWordCorrections(currentSelection.text, fullResult);
            if (mode === 'spellcheck') {
                contentPane.replaceChildren(renderSpellcheckDiffFragment(currentSelection.text, fullResult));
            } else {
                renderMarkdown(contentPane, fullResult);
            }
            renderCorrectionControls();
            finishStream(true);
        } else {
            startStream();
        }
    }

    checkCacheAndRun();
}
