/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { OutputChannel } from "vscode";

export class AzureOutputChannel implements OutputChannel {
    public readonly name: string;
    private _outputChannel: OutputChannel;

    constructor(name: string, outputChannel: OutputChannel) {
        this.name = name;
        this._outputChannel = outputChannel;
    }

    public append(value: string): void {
        this._outputChannel.append(value);
    }

    public appendLine(value: string, resourceName?: string, date?: Date): void {
        // tslint:disable-next-line:strict-boolean-expressions
        date = date || new Date();
        this._outputChannel.appendLine(`${date.toLocaleTimeString()}${resourceName ? ' '.concat(resourceName) : ''}: ${value}`);
    }

    public clear(): void {
        this._outputChannel.clear();
    }

    public show(): void {
        this._outputChannel.show();
    }

    public hide(): void {
        this._outputChannel.hide();
    }

    public dispose(): void {
        this._outputChannel.dispose();
        this.dispose();
    }

}
