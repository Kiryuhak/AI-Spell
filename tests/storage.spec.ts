import { beforeEach, expect, test, vi } from 'vitest';
import { applyHistoryMutation } from '../src/history-store';
import { applyUsageMutation } from '../src/usage-stats';
import { applySettingsMutation } from '../src/settings-store';

let storage: Record<string, unknown>;

beforeEach(() => {
    storage = {};
    vi.stubGlobal('chrome', {
        storage: {
            local: {
                async get(keys: string[] | Record<string, unknown> | null) {
                    await Promise.resolve();
                    if (keys === null) return { ...storage };
                    if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, storage[key]]));
                    return Object.fromEntries(
                        Object.entries(keys).map(([key, fallback]) => [key, storage[key] ?? fallback]),
                    );
                },
                async set(updates: Record<string, unknown>) {
                    await Promise.resolve();
                    Object.assign(storage, structuredClone(updates));
                },
            },
        },
    });
});

test('не теряет историю при параллельных записях', async () => {
    await Promise.all(
        Array.from({ length: 20 }, (_, id) =>
            applyHistoryMutation('add', {
                item: {
                    id,
                    mode: 'spellcheck',
                    original: `До ${id}`,
                    result: `После ${id}`,
                    date: new Date().toISOString(),
                },
            }),
        ),
    );
    expect(storage.aiHistory).toHaveLength(20);
});

test('не теряет статистику при параллельных запросах', async () => {
    await Promise.all(
        Array.from({ length: 25 }, () =>
            applyUsageMutation('request', {
                mode: 'style',
                latencyMs: 10,
                success: true,
            }),
        ),
    );
    expect(storage.usageStats).toMatchObject({ requests: 25, totalLatencyMs: 250, byMode: { style: 25 } });
});

test('не теряет слова словаря при параллельном добавлении', async () => {
    await Promise.all(
        Array.from({ length: 30 }, (_, index) =>
            applySettingsMutation('addPersonalDictionaryWord', { value: `Слово-${index}` }),
        ),
    );
    expect(storage.personalDictionary).toHaveLength(30);
});

test('атомарно добавляет и удаляет пользовательские команды', async () => {
    await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
            applySettingsMutation('upsertCustomCommand', {
                command: { id: String(index), name: `Команда ${index}`, prompt: `Инструкция ${index}` },
            }),
        ),
    );
    await Promise.all([
        applySettingsMutation('deleteCustomCommand', { id: '2' }),
        applySettingsMutation('deleteCustomCommand', { id: '5' }),
    ]);
    expect(storage.customCommands).toHaveLength(6);
});
