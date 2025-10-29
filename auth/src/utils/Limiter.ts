/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is lifted directly from https://github.com/microsoft/vscode/blob/f8e2f71c2f78ac1ce63389e761e2aefc724646fc/extensions/git/src/util.ts#L411-L454,
// which itself looks like just a simplified version of https://github.com/microsoft/vscode/blob/f8e2f71c2f78ac1ce63389e761e2aefc724646fc/src/vs/base/common/async.ts#L696-L786

interface ILimitedTaskFactory<T> {
    factory: () => Promise<T>;
    c: (value: T | Promise<T>) => void;
    e: (error?: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export class Limiter<T> {

    private runningPromises: number;
    private maxDegreeOfParalellism: number;
    private outstandingPromises: ILimitedTaskFactory<T>[];

    constructor(maxDegreeOfParalellism: number) {
        this.maxDegreeOfParalellism = maxDegreeOfParalellism;
        this.outstandingPromises = [];
        this.runningPromises = 0;
    }

    queue(factory: () => Promise<T>): Promise<T> {
        return new Promise<T>((c, e) => {
            this.outstandingPromises.push({ factory, c, e });
            this.consume();
        });
    }

    private consume(): void {
        while (this.outstandingPromises.length && this.runningPromises < this.maxDegreeOfParalellism) {
            const iLimitedTask = this.outstandingPromises.shift()!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
            this.runningPromises++;

            const promise = iLimitedTask.factory();
            promise.then(iLimitedTask.c, iLimitedTask.e);
            promise.then(() => this.consumed(), () => this.consumed());
        }
    }

    private consumed(): void {
        this.runningPromises--;

        if (this.outstandingPromises.length > 0) {
            this.consume();
        }
    }
}
