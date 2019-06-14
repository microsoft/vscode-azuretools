/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { OutputChannel, ViewColumn } from "vscode";

export class AzExtOutputChannel implements OutputChannel {
    public readonly name: string;
    private _outputChannel: OutputChannel;

    constructor(name: string, outputChannel: OutputChannel) {
        this.name = name;
        this._outputChannel = outputChannel;
    }

    public append(value: string): void {
        this._outputChannel.append(value);
    }

    public appendLine(value: string): void {
        this._outputChannel.appendLine(value);
    }

    public appendLog(value: string, options: { resourceName?: string, date?: Date }): void {
        // tslint:disable-next-line:strict-boolean-expressions
        const date: Date = options.date || new Date();
        this.appendLine(`${date.toLocaleTimeString()}${options.resourceName ? ' '.concat(options.resourceName) : ''}: ${value}`);
    }

    public clear(): void {
        this._outputChannel.clear();
    }

    public show(preserveFocus?: boolean | undefined): void;
    public show(column?: ViewColumn | undefined, preserveFocus?: boolean | undefined): void;
    // tslint:disable-next-line: no-any
    public show(_column?: any, preserveFocus?: boolean | undefined): void {
        this._outputChannel.show(preserveFocus);
    }

    public hide(): void {
        this._outputChannel.hide();
    }

    public dispose(): void {
        this._outputChannel.dispose();
    }

}
