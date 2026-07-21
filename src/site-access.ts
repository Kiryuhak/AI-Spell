const REGISTERED_SCRIPT_ID = 'lexisync-enabled-sites';
const INJECT_SCRIPT_FILE = 'inject.js';

export function getOriginPattern(urlValue: string): string | null {
    try {
        const url = new URL(urlValue);
        return ['http:', 'https:'].includes(url.protocol) ? `${url.origin}/*` : null;
    } catch {
        return null;
    }
}

export async function syncRegisteredSiteScripts(): Promise<void> {
    const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [REGISTERED_SCRIPT_ID] });
    if (registered.length) await chrome.scripting.unregisterContentScripts({ ids: [REGISTERED_SCRIPT_ID] });
}

async function contentScriptIsReady(tabId: number, frameId?: number): Promise<boolean> {
    try {
        const response = await chrome.tabs.sendMessage(tabId, { action: 'lexisyncPing' }, frameId === undefined ? undefined : { frameId });
        return response?.ok === true;
    } catch {
        return false;
    }
}

export async function ensureContentScript(tabId: number, frameId?: number): Promise<void> {
    if (await contentScriptIsReady(tabId, frameId)) return;
    await chrome.scripting.executeScript({
        target: frameId === undefined ? { tabId, allFrames: true } : { tabId, frameIds: [frameId] },
        files: [INJECT_SCRIPT_FILE],
    });
}

export async function sendToTabWithInjection(tabId: number, message: unknown, frameId?: number): Promise<unknown> {
    await ensureContentScript(tabId, frameId);
    return chrome.tabs.sendMessage(tabId, message, frameId === undefined ? undefined : { frameId });
}

export function initializeSiteAccess(): void {
    void syncRegisteredSiteScripts().catch((error) => console.error('Не удалось обновить сценарии LexiSync:', error));
}
