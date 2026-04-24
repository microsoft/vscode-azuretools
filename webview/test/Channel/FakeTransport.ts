/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type Transport, type TransportMessage } from '../../src/webview/Channel/Transport';

/**
 * In-memory Transport pair for unit-testing CommonChannel. Each instance has a
 * `peer` counterpart; anything posted to one is delivered to the other's listeners.
 */
export class FakeTransport implements Transport {
    public readonly name = 'FakeTransport';
    public readonly posted: TransportMessage[] = [];
    public peer: FakeTransport | undefined;

    private listeners: ((message: TransportMessage) => void)[] = [];
    private isDisposed = false;

    post(message: TransportMessage): PromiseLike<boolean> {
        this.posted.push(message);
        if (this.peer && !this.peer.isDisposed) {
            queueMicrotask(() => this.peer?.deliver(message));
        }
        return Promise.resolve(true);
    }

    on(callback: (message: TransportMessage) => void): void {
        this.listeners.push(callback);
    }

    off(callback: (message: TransportMessage) => void): void {
        this.listeners = this.listeners.filter((cb) => cb !== callback);
    }

    dispose(): void {
        this.isDisposed = true;
        this.listeners = [];
    }

    /** Synchronously deliver a message to listeners (bypasses the peer). */
    deliver(message: TransportMessage): void {
        for (const cb of [...this.listeners]) {
            cb(message);
        }
    }

    get listenerCount(): number {
        return this.listeners.length;
    }
}

export function createTransportPair(): [FakeTransport, FakeTransport] {
    const a = new FakeTransport();
    const b = new FakeTransport();
    a.peer = b;
    b.peer = a;
    return [a, b];
}

export async function flushMicrotasks(times = 3): Promise<void> {
    for (let i = 0; i < times; i++) {
        await Promise.resolve();
    }
}
