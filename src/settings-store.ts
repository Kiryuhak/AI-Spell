import { enqueueStorageMutation } from './storage-queue';
import type { CustomCommand, StyleProfile } from './types';

export type SettingsMutation =
    | 'addPersonalDictionaryWord'
    | 'addAdaptiveBlockedWord'
    | 'upsertCustomCommand'
    | 'deleteCustomCommand'
    | 'replaceStyleProfiles';

interface SettingsMutationPayload {
    value?: unknown;
    command?: unknown;
    id?: unknown;
    profiles?: unknown;
    activeProfileId?: unknown;
}

function isCustomCommand(value: unknown): value is CustomCommand {
    if (!value || typeof value !== 'object') return false;
    const command = value as Partial<CustomCommand>;
    return (
        typeof command.id === 'string' &&
        typeof command.name === 'string' &&
        command.name.trim().length > 0 &&
        typeof command.prompt === 'string' &&
        command.prompt.trim().length > 0
    );
}

function normalizeCommand(command: CustomCommand): CustomCommand {
    return {
        id: command.id.slice(0, 100),
        name: command.name.trim().slice(0, 40),
        prompt: command.prompt.trim().slice(0, 2000),
    };
}

async function requestSettingsMutation<T>(mutation: SettingsMutation, payload: SettingsMutationPayload): Promise<T> {
    const response = await chrome.runtime.sendMessage({
        action: 'storageMutation',
        domain: 'settings',
        mutation,
        payload,
    });
    if (response?.ok !== true) throw new Error(response?.error || 'SETTINGS_MUTATION_FAILED');
    return response.data as T;
}

export function addPersonalDictionaryWord(value: string): Promise<string[]> {
    return requestSettingsMutation('addPersonalDictionaryWord', { value });
}

export function addAdaptiveBlockedWord(value: string): Promise<string[]> {
    return requestSettingsMutation('addAdaptiveBlockedWord', { value });
}

export function upsertCustomCommand(command: CustomCommand): Promise<CustomCommand[]> {
    return requestSettingsMutation('upsertCustomCommand', { command });
}

export function deleteCustomCommand(id: string): Promise<CustomCommand[]> {
    return requestSettingsMutation('deleteCustomCommand', { id });
}

export function replaceStyleProfiles(profiles: StyleProfile[], activeProfileId: string): Promise<void> {
    return requestSettingsMutation('replaceStyleProfiles', { profiles, activeProfileId });
}

export function applySettingsMutation(mutation: SettingsMutation, payload: SettingsMutationPayload): Promise<unknown> {
    return enqueueStorageMutation(async () => {
        if (mutation === 'addPersonalDictionaryWord' || mutation === 'addAdaptiveBlockedWord') {
            if (typeof payload.value !== 'string') throw new Error('INVALID_SETTINGS_VALUE');
            const key = mutation === 'addPersonalDictionaryWord' ? 'personalDictionary' : 'adaptiveBlockedWords';
            const normalized = payload.value.trim().slice(0, 120);
            if (!normalized) throw new Error('INVALID_SETTINGS_VALUE');
            const stored = await chrome.storage.local.get({ [key]: [] });
            const values = Array.isArray(stored[key]) ? stored[key].map(String) : [];
            if (!values.some((item) => item.toLocaleLowerCase('ru-RU') === normalized.toLocaleLowerCase('ru-RU'))) {
                values.push(normalized);
            }
            const result = values.slice(0, 2000).sort((a, b) => a.localeCompare(b, 'ru'));
            await chrome.storage.local.set({ [key]: result });
            return result;
        }
        if (mutation === 'upsertCustomCommand') {
            if (!isCustomCommand(payload.command)) throw new Error('INVALID_CUSTOM_COMMAND');
            const stored = await chrome.storage.local.get({ customCommands: [] });
            const commands = Array.isArray(stored.customCommands)
                ? stored.customCommands.filter(isCustomCommand).map(normalizeCommand).slice(0, 8)
                : [];
            const command = normalizeCommand(payload.command);
            const index = commands.findIndex((item) => item.id === command.id);
            if (index >= 0) commands[index] = command;
            else if (commands.length < 8) commands.push(command);
            else throw new Error('CUSTOM_COMMAND_LIMIT');
            await chrome.storage.local.set({ customCommands: commands });
            return commands;
        }
        if (mutation === 'deleteCustomCommand') {
            if (typeof payload.id !== 'string') throw new Error('INVALID_CUSTOM_COMMAND_ID');
            const stored = await chrome.storage.local.get({ customCommands: [] });
            const commands = Array.isArray(stored.customCommands)
                ? stored.customCommands
                      .filter(isCustomCommand)
                      .map(normalizeCommand)
                      .filter((item) => item.id !== payload.id)
                      .slice(0, 8)
                : [];
            await chrome.storage.local.set({ customCommands: commands });
            return commands;
        }
        if (mutation === 'replaceStyleProfiles') {
            if (!Array.isArray(payload.profiles)) throw new Error('INVALID_STYLE_PROFILES');
            const profiles = payload.profiles.slice(0, 8) as StyleProfile[];
            const activeProfileId = typeof payload.activeProfileId === 'string' ? payload.activeProfileId : '';
            await chrome.storage.local.set({ styleProfiles: profiles, activeStyleProfileId: activeProfileId });
            return;
        }
        throw new Error('INVALID_SETTINGS_MUTATION');
    });
}
