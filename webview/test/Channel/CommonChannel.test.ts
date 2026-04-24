/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CommonChannel, getErrorMessage } from '../../src/webview/Channel/CommonChannel';
import { createTransportPair, FakeTransport, flushMicrotasks } from './FakeTransport';

suite('(unit) CommonChannel', () => {
    let transports: [FakeTransport, FakeTransport];
    let a: CommonChannel;
    let b: CommonChannel;
    const channels: CommonChannel[] = [];

    function makeChannel(name: string, transport: FakeTransport): CommonChannel {
        const ch = new CommonChannel(name, transport);
        channels.push(ch);
        return ch;
    }

    setup(() => {
        transports = createTransportPair();
        a = makeChannel('a', transports[0]);
        b = makeChannel('b', transports[1]);
    });

    teardown(() => {
        while (channels.length) {
            channels.pop()?.dispose();
        }
    });

    suite('events', () => {
        test('fires listeners with the provided params', async () => {
            const received: unknown[][] = [];
            b.on('greet', (...params) => {
                received.push(params);
            });

            await a.postMessage({ type: 'event', name: 'greet', params: ['hello', 42] });
            await flushMicrotasks();

            assert.deepStrictEqual(received, [['hello', 42]]);
        });

        test('`once` listeners fire exactly once and are auto-removed', async () => {
            let calls = 0;
            b.once('ping', () => {
                calls++;
            });

            await a.postMessage({ type: 'event', name: 'ping', params: [] });
            await flushMicrotasks();
            await a.postMessage({ type: 'event', name: 'ping', params: [] });
            await flushMicrotasks();

            assert.strictEqual(calls, 1);
        });

        test('`off` removes the specific callback but leaves others', async () => {
            let aCalls = 0;
            let bCalls = 0;
            const cbA = () => { aCalls++; };
            const cbB = () => { bCalls++; };
            b.on('ping', cbA);
            b.on('ping', cbB);

            b.off('ping', cbA);
            await a.postMessage({ type: 'event', name: 'ping', params: [] });
            await flushMicrotasks();

            assert.strictEqual(aCalls, 0);
            assert.strictEqual(bCalls, 1);
        });

        test('removeAllListeners(event) scoped; removeAllListeners() global', async () => {
            let pings = 0;
            let pongs = 0;
            b.on('ping', () => { pings++; });
            b.on('pong', () => { pongs++; });

            b.removeAllListeners('ping');
            await a.postMessage({ type: 'event', name: 'ping', params: [] });
            await a.postMessage({ type: 'event', name: 'pong', params: [] });
            await flushMicrotasks();
            assert.strictEqual(pings, 0);
            assert.strictEqual(pongs, 1);

            b.removeAllListeners();
            await a.postMessage({ type: 'event', name: 'pong', params: [] });
            await flushMicrotasks();
            assert.strictEqual(pongs, 1);
        });

        test('a throwing listener does not prevent other listeners from being called', async () => {
            let secondCalled = false;
            b.on('ping', () => {
                throw new Error('boom');
            });
            b.on('ping', () => {
                secondCalled = true;
            });

            await a.postMessage({ type: 'event', name: 'ping', params: [] });
            await flushMicrotasks();

            assert.strictEqual(secondCalled, true);
        });
    });

    suite('requests', () => {
        test('resolves with the handler return value', async () => {
            b.on('add', (x, y) => (x as number) + (y as number));

            const result = await a.postMessage({ type: 'request', name: 'add', params: [2, 3] });

            assert.strictEqual(result, 5);
        });

        test('awaits async handlers', async () => {
            b.on('slow', async (v) => {
                await Promise.resolve();
                return v;
            });

            const result = await a.postMessage({ type: 'request', name: 'slow', params: ['ok'] });

            assert.strictEqual(result, 'ok');
        });

        test('rejects when handler rejects', async () => {
            b.on('fail', () => Promise.reject(new Error('async bad')));

            await assert.rejects(
                Promise.resolve(a.postMessage({ type: 'request', name: 'fail', params: [] })),
                /async bad/,
            );
        });

        test('times out after 15 seconds with "Request timed out"', async () => {
            // No handler registered on the peer side; intercept to prevent a response.
            const orphan = makeChannel('orphan', new FakeTransport());
            const clock = new FakeClock();
            clock.install();
            try {
                const pending = orphan.postMessage({ type: 'request', name: 'ghost', params: [] });
                let settled = false;
                pending.then(
                    () => { settled = true; },
                    () => { settled = true; },
                );

                clock.tick(14_999);
                await flushMicrotasks();
                assert.strictEqual(settled, false, 'request should not have settled yet');

                // The cleanup interval runs every 500ms, so advance enough to cross the expiry.
                clock.tick(1_000);
                await flushMicrotasks();

                await assert.rejects(Promise.resolve(pending), /Request timed out/);
            } finally {
                clock.uninstall();
            }
        });
    });

    suite('dispose', () => {
        test('rejects pending requests with "Channel disposed"', async () => {
            // No handler on peer — request will stay pending.
            const orphan = makeChannel('orphan', new FakeTransport());
            const pending = orphan.postMessage({ type: 'request', name: 'ghost', params: [] });
            orphan.dispose();

            await assert.rejects(Promise.resolve(pending), /Channel disposed/);
        });

        test('postMessage after dispose rejects synchronously', async () => {
            a.dispose();
            await assert.rejects(
                Promise.resolve(a.postMessage({ type: 'event', name: 'x', params: [] })),
                /Channel disposed/,
            );
        });

        test('detaches its listener from the transport', () => {
            const before = transports[0].listenerCount;
            a.dispose();
            assert.strictEqual(transports[0].listenerCount, before - 1);
        });

        test('on/once/off become no-ops after dispose', async () => {
            a.dispose();
            let calls = 0;
            a.on('ping', () => { calls++; });
            // Re-enable transport delivery manually to make sure the listener was not registered.
            transports[0].deliver({ id: 'x', payload: { type: 'event', name: 'ping', params: [] } });
            assert.strictEqual(calls, 0);
        });
    });

    suite('robustness', () => {
        test('ignores malformed payloads', async () => {
            // Should not throw when receiving a message with a non-object payload.
            transports[1].deliver({ id: '1', payload: 'not-a-payload' });
            transports[1].deliver({ id: '2', payload: null as unknown as object });
            transports[1].deliver({ id: '3', payload: { no: 'type' } });
            // If we got here without throwing, the test passes.
        });

        test('ignores responses for unknown request ids', async () => {
            transports[1].deliver({ id: 'nope', payload: { type: 'response', value: 1 } });
            transports[1].deliver({ id: 'nope', payload: { type: 'error', message: 'x' } });
        });
    });

    suite('getErrorMessage', () => {
        test('returns the message of an Error', () => {
            assert.strictEqual(getErrorMessage(new Error('hi')), 'hi');
        });

        test('returns the message field of an error-like object', () => {
            assert.strictEqual(getErrorMessage({ message: 'from object' }), 'from object');
        });

        test('stringifies plain objects', () => {
            assert.strictEqual(getErrorMessage({ foo: 'bar' }), JSON.stringify({ foo: 'bar' }));
        });

        test('falls back to String() for circular references', () => {
            const obj: Record<string, unknown> = {};
            obj.self = obj;
            const msg = getErrorMessage(obj);
            assert.strictEqual(typeof msg, 'string');
            assert.ok(msg.length > 0);
        });
    });
});

/**
 * Minimal fake clock for testing setInterval-based timeouts without pulling in sinon.
 * Replaces Date.now, setInterval, and clearInterval on the global object while installed.
 */
class FakeClock {
    private now = 0;
    private nextId = 1;
    private intervals = new Map<number, { cb: () => void; period: number; nextAt: number }>();
    private originals: {
        now: typeof Date.now;
        setInterval: typeof setInterval;
        clearInterval: typeof clearInterval;
    } | undefined;

    install(): void {
        if (this.originals) {return;}
        this.originals = {
            now: Date.now,
            setInterval: globalThis.setInterval,
            clearInterval: globalThis.clearInterval,
        };
        Date.now = () => this.now;
        (globalThis as unknown as { setInterval: (cb: () => void, ms: number) => number }).setInterval = (
            cb: () => void,
            ms: number,
        ): number => {
            const id = this.nextId++;
            this.intervals.set(id, { cb, period: ms, nextAt: this.now + ms });
            return id;
        };
        (globalThis as unknown as { clearInterval: (id: number) => void }).clearInterval = (id: number): void => {
            this.intervals.delete(id);
        };
    }

    uninstall(): void {
        if (!this.originals) {return;}
        Date.now = this.originals.now;
        (globalThis as unknown as { setInterval: typeof setInterval }).setInterval = this.originals.setInterval;
        (globalThis as unknown as { clearInterval: typeof clearInterval }).clearInterval = this.originals.clearInterval;
        this.originals = undefined;
        this.intervals.clear();
    }

    tick(ms: number): void {
        const end = this.now + ms;
        // Fire intervals in order, respecting their next-fire times.
        while (true) {
            let nextId: number | undefined;
            let nextAt = Infinity;
            for (const [id, entry] of this.intervals) {
                if (entry.nextAt <= end && entry.nextAt < nextAt) {
                    nextAt = entry.nextAt;
                    nextId = id;
                }
            }
            if (nextId === undefined) {break;}
            const entry = this.intervals.get(nextId);
            if (!entry) {break;}
            this.now = entry.nextAt;
            entry.nextAt += entry.period;
            entry.cb();
        }
        this.now = end;
    }
}
