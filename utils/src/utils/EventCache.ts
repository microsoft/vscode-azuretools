/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class EventCache<T> implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];

    private valuesPromise: Promise<T[]> | undefined;

    public constructor(private readonly callback: () => Promise<T[]>, flushEvents: vscode.Event<never>[] = []) {
        flushEvents.forEach(e => this.flushOn(e));
    }

    public async getValues(): Promise<T[]> {
        this.valuesPromise ||= this.callback();
        return this.valuesPromise;
    }

    public dispose(): void {
        this.disposables.forEach(d => void d.dispose());
    }

    public flushOn(event: vscode.Event<never>): void {
        this.disposables.push(event(this.flush, this));
    }

    public flush(): void {
        this.valuesPromise = undefined;
    }
}

export class IterableEventCache<T> extends EventCache<T> {
    public constructor(callback: () => AsyncIterable<T>, flushEvents?: vscode.Event<never>[]) {
        super(async () => {
            const values: T[] = [];
            for await (const value of callback()) {
                values.push(value);
            }
            return values;
        }, flushEvents);
    }
}
