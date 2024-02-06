/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { AzExtInputBoxOptions, AzExtOpenDialogOptions, AzureUserInputQueue, IAzureMessageOptions, IAzureQuickPickItem, IAzureQuickPickOptions, IAzureUserInput, PromptResult, type AzExtUserInputWithInputQueue as AzExtUserInputWithInputQueueType } from "../../";
import { UserCancelledError } from "../errors";
import { AzExtUserInput, addStepTelemetry } from "./AzExtUserInput";
import { IInternalActionContext } from "./IInternalActionContext";

export class AzExtUserInputWithInputQueue implements AzExtUserInputWithInputQueueType {
    private _context: IInternalActionContext;
    private _inputsQueue: AzureUserInputQueue;
    private _onDidFinishPromptEmitter: vscode.EventEmitter<PromptResult>;
    private _realAzureUserInput: IAzureUserInput;
    private _isPrompting: boolean;

    constructor(context: IInternalActionContext, returnValueQueue: AzureUserInputQueue) {
        this._context = context;
        this._onDidFinishPromptEmitter = new vscode.EventEmitter<PromptResult>();
        this._realAzureUserInput = new AzExtUserInput(context, this._onDidFinishPromptEmitter);
        this._inputsQueue = returnValueQueue;
        this._isPrompting = false;
    }

    public get onDidFinishPrompt() {
        return this._onDidFinishPromptEmitter.event;
    }

    public get isPrompting(): boolean {
        return this._isPrompting;
    }

    public async showQuickPick<TPick extends IAzureQuickPickItem<unknown>>(items: TPick[] | Promise<TPick[]>, options: IAzureQuickPickOptions): Promise<TPick | TPick[]> {
        addStepTelemetry(this._context, options.stepName, 'quickPick', options.placeHolder);
        if (this._context.ui.wizard?.cancellationToken.isCancellationRequested) {
            throw new UserCancelledError();
        }
        this._isPrompting = true;

        let result: TPick;
        const nextItemInQueue = (this._inputsQueue.shift() as TPick | null | undefined);
        if (!nextItemInQueue) {
            result = await this._realAzureUserInput.showQuickPick(items, options);
        } else {
            const resolvedItems = await Promise.resolve(items);
            const matchingItem = resolvedItems.find(item => item.label === nextItemInQueue.label);
            if (!matchingItem) {
                throw new Error(`Could not find item with label "${nextItemInQueue.label}" in quick pick items`);
            }
            result = matchingItem;
            this._onDidFinishPromptEmitter.fire({ value: result });
        }

        this._isPrompting = false;
        return result;
    }

    public async showInputBox(options: AzExtInputBoxOptions): Promise<string> {
        addStepTelemetry(this._context, options.stepName, 'inputBox', options.prompt);
        if (this._context.ui.wizard?.cancellationToken.isCancellationRequested) {
            throw new UserCancelledError();
        }
        this._isPrompting = true;

        let result: string;
        const nextItemInQueue = (this._inputsQueue.shift() as string | null | undefined);
        if (!nextItemInQueue) {
            result = await this._realAzureUserInput.showInputBox(options);
        } else {
            result = nextItemInQueue;
            this._onDidFinishPromptEmitter.fire({
                value: result,
                matchesDefault: result === options.value
            });
        }

        this._isPrompting = false;
        return result;
    }

    public async showOpenDialog(options: AzExtOpenDialogOptions): Promise<vscode.Uri[]> {
        addStepTelemetry(this._context, options.stepName, 'openDialog', options.title);
        if (this._context.ui.wizard?.cancellationToken.isCancellationRequested) {
            throw new UserCancelledError();
        }
        this._isPrompting = true;

        let result: vscode.Uri[];
        const nextItemInQueue = (this._inputsQueue.shift() as vscode.Uri[] | null | undefined);
        if (!nextItemInQueue) {
            result = await this._realAzureUserInput.showOpenDialog(options);
        } else {
            result = nextItemInQueue;
            this._onDidFinishPromptEmitter.fire({ value: result });
        }

        this._isPrompting = false;
        return result;
    }

    public async showWarningMessage<T extends vscode.MessageItem>(message: string, ...items: T[]): Promise<T>;
    public async showWarningMessage<T extends vscode.MessageItem>(message: string, options: IAzureMessageOptions, ...items: T[]): Promise<T>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async showWarningMessage<T extends vscode.MessageItem>(message: string, ...args: any[]): Promise<T> {
        let stepName: string | undefined;
        const firstArg: unknown = args[0];
        if (typeof firstArg === 'object' && firstArg && 'stepName' in firstArg) {
            stepName = (<Partial<IAzureMessageOptions>>firstArg).stepName;
        }
        addStepTelemetry(this._context, stepName, 'warningMessage', message);

        if (this._context.ui.wizard?.cancellationToken.isCancellationRequested) {
            throw new UserCancelledError();
        }
        this._isPrompting = true;

        let result: T;
        const nextItemInQueue = (this._inputsQueue.shift() as T | null | undefined);
        if (!nextItemInQueue) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment
            result = await this._realAzureUserInput.showWarningMessage(message, ...args);
        } else {
            result = nextItemInQueue;
            this._onDidFinishPromptEmitter.fire({ value: result });
        }

        this._isPrompting = false;
        return result;
    }
}
