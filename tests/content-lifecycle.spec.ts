import { afterEach, expect, test, vi } from 'vitest';
import { createRequestLifecycle } from '../src/request-lifecycle';

afterEach(() => {
    vi.useRealTimers();
});

test('останавливает запрос и все таймеры при закрытии панели', () => {
    vi.useFakeTimers();
    const onDispose = vi.fn();
    const intervalCallback = vi.fn();
    const timeoutCallback = vi.fn();
    const lifecycle = createRequestLifecycle(onDispose);
    lifecycle.setInterval(intervalCallback, 100);
    lifecycle.setTimeout(timeoutCallback, 200);

    vi.advanceTimersByTime(100);
    expect(intervalCallback).toHaveBeenCalledOnce();
    lifecycle.dispose();
    lifecycle.dispose();
    vi.advanceTimersByTime(1_000);

    expect(onDispose).toHaveBeenCalledOnce();
    expect(intervalCallback).toHaveBeenCalledOnce();
    expect(timeoutCallback).not.toHaveBeenCalled();
    expect(lifecycle.disposed).toBe(true);
});
