/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Event, LogLevel, LogOutputChannel, OutputChannel, ViewColumn, window, workspace, WorkspaceConfiguration } from "vscode";
import * as types from '../index';

export function createAzExtLogOutputChannel(name: string): types.IAzExtLogOutputChannel {
    return new AzExtLogOutputChannel(name);
}

export function createAzExtOutputChannel(name: string, extensionPrefix: string): types.IAzExtOutputChannel {
    const outputChannel = new AzExtOutputChannel(name);
    outputChannel.extensionPrefix = extensionPrefix;
    return outputChannel;
}

export class AzExtOutputChannel implements types.IAzExtOutputChannel {
    public readonly name: string;
    public extensionPrefix: string;
    protected _outputChannel: OutputChannel | LogOutputChannel;

    constructor(name: string) {
        this.name = name;
        this._outputChannel = this.createOutputChannel(name);
    }

    protected createOutputChannel(name: string): OutputChannel {
        return window.createOutputChannel(name);
    }

    public append(value: string): void {
        this._outputChannel.append(value);
    }

    public appendLine(value: string): void {
        this._outputChannel.appendLine(value);
    }

    protected shouldIncludeTimestamps(): boolean {
        const enableOutputTimestampsSetting: string = 'enableOutputTimestamps';
        const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(this.extensionPrefix);
        return !!projectConfiguration.get<boolean>(enableOutputTimestampsSetting);
    }

    public appendLog(value: string, options?: { resourceName?: string, date?: Date }): void {
        if (!this.shouldIncludeTimestamps()) {
            this.appendLine(value);
        } else {
            options ||= {};
            const date: Date = options.date || new Date();
            this.appendLine(`${date.toLocaleTimeString()}${options.resourceName ? ' '.concat(options.resourceName) : ''}: ${value}`);
        }
    }

    public clear(): void {
        this._outputChannel.clear();
    }

    public replace(value: string): void {
        this._outputChannel.replace(value);
    }

    public show(preserveFocus?: boolean | undefined): void;
    public show(column?: ViewColumn | undefined, preserveFocus?: boolean | undefined): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export class AzExtLogOutputChannel extends AzExtOutputChannel implements LogOutputChannel {
    protected override _outputChannel: LogOutputChannel;
    readonly logLevel: LogLevel;
    readonly onDidChangeLogLevel: Event<LogLevel>;

    constructor(name: string) {
        super(name);
        this.onDidChangeLogLevel = this._outputChannel.onDidChangeLogLevel;
        this.logLevel = this._outputChannel.logLevel;
    }

    protected shouldIncludeTimestamps(): boolean {
        return false;
    }

    protected override createOutputChannel(name: string): LogOutputChannel {
        return window.createOutputChannel(name, {
            log: true,
        });
    }

    trace(message: string, ...args: unknown[]): void {
        this._outputChannel.trace(message, ...args);
    }

    debug(message: string, ...args: unknown[]): void {
        this._outputChannel.debug(message, ...args);
    }

    info(message: string, ...args: unknown[]): void {
        this._outputChannel.info(message, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        this._outputChannel.warn(message, ...args);
    }

    error(error: string | Error, ...args: unknown[]): void {
        this._outputChannel.error(error, ...args);
    }
}
