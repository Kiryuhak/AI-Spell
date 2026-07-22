import { beforeEach, expect, test, vi } from 'vitest';
import { ensureContentScript } from '../src/site-access';

let ready = false;
const executeScript = vi.fn(async () => {
    await Promise.resolve();
    ready = true;
});

beforeEach(() => {
    ready = false;
    executeScript.mockClear();
    vi.stubGlobal('chrome', {
        tabs: {
            async sendMessage() {
                if (!ready) throw new Error('Receiving end does not exist');
                return { ok: true };
            },
        },
        scripting: { executeScript },
    });
});

test('объединяет параллельные попытки инъекции в одну', async () => {
    await Promise.all([ensureContentScript(42), ensureContentScript(42), ensureContentScript(42)]);
    expect(executeScript).toHaveBeenCalledOnce();
});
