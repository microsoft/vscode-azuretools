/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { OutputChannel, ViewColumn, window, workspace, WorkspaceConfiguration } from "vscode";
import * as types from '../index';

export class AzExtOutputChannel implements types.AzExtOutputChannel {
    public readonly name: string;
    public readonly extensionPrefix: string;
    private _outputChannel: OutputChannel;

    constructor(name: string, extensionPrefix: string) {
        this.name = name;
        this.extensionPrefix = extensionPrefix;
        this._outputChannel = window.createOutputChannel(this.name);
    }

    public append(value: string): void {
        this._outputChannel.append(value);
    }

    public appendLine(value: string): void {
        this._outputChannel.appendLine(value);
    }

    public appendLog(value: string, options?: { resourceName?: string, date?: Date }): void {
        const enableOutputTimestampsSetting: string = 'enableOutputTimestamps';
        const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(this.extensionPrefix);
        const result: boolean | undefined = projectConfiguration.get<boolean>(enableOutputTimestampsSetting);

        if (!result) {
            this.appendLine(value);
        } else {
            // tslint:disable: strict-boolean-expressions
            options = options || {};
            const date: Date = options.date || new Date();
            this.appendLine(`${date.toLocaleTimeString()}${options.resourceName ? ' '.concat(options.resourceName) : ''}: ${value}`);
        }
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
