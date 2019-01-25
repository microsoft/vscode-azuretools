/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OutputChannel } from 'vscode';

export class CommandOptions {
    public command: string;
    public valuesToObfuscate?: string | string[];
    public readonly workingDirectory?: string;
    private readonly _outputChannel?: OutputChannel;

    public constructor(command: string, outputChannel?: OutputChannel, workingDirectory?: string, valuesToObfuscate?: string | string[]) {
        this.command = command;
        this._outputChannel = outputChannel;
        this.workingDirectory = workingDirectory;
        this.valuesToObfuscate = valuesToObfuscate;
    }

    public appendLine(data: string, show: boolean = false): void {
        if (this._outputChannel) {
            if (this.valuesToObfuscate) {
                data = this.obfuscateValue(data);
            }

            if (show) {
                this._outputChannel.show();
            }
            this._outputChannel.appendLine(data);
        }
    }

    public obfuscateValue(data: string): string {
        if (this.valuesToObfuscate) {
            if (typeof this.valuesToObfuscate === 'string') {
                    this.valuesToObfuscate = [this.valuesToObfuscate];
            }

            for (const value of this.valuesToObfuscate) {
                data = data.replace(value, '****');
            }
        }
        return data;
    }

    public showOutputChannel(): void {
        if (this._outputChannel) {
            this._outputChannel.show();
        }
    }
}
