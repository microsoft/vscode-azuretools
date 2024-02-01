/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, EventEmitter, MessageItem, Uri } from 'vscode';
import * as types from '../../index';
import { UserCancelledError } from '../errors';
import { IInternalActionContext, IInternalAzureWizard } from './IInternalActionContext';
import { showInputBox } from './showInputBox';
import { showOpenDialog } from './showOpenDialog';
import { showQuickPick } from './showQuickPick';
import { showWarningMessage } from './showWarningMessage';

export class AzExtUserInput implements types.IAzureUserInput {
    public wizard?: IInternalAzureWizard;
    private _onDidFinishPromptEmitter: EventEmitter<types.PromptResult>;
    private _context: IInternalActionContext;
    private _isPrompting: boolean = false;

    public constructor(context: IInternalActionContext, onDidFinishPromptEmitter?: EventEmitter<types.PromptResult>) {
        this._context = context;
        this._onDidFinishPromptEmitter = onDidFinishPromptEmitter || new EventEmitter<types.PromptResult>();
    }

    public get onDidFinishPrompt(): Event<types.PromptResult> {
        return this._onDidFinishPromptEmitter.event;
    }

    public get isPrompting(): boolean {
        return this._isPrompting;
    }

    public async showQuickPick<TPick extends types.IAzureQuickPickItem<unknown>>(picks: TPick[] | Promise<TPick[]>, options: types.IAzureQuickPickOptions): Promise<TPick | TPick[]> {
        addStepTelemetry(this._context, options.stepName, 'quickPick', options.placeHolder);
        if (this._context.ui.wizard?.cancellationToken.isCancellationRequested) {
            throw new UserCancelledError();
        }
        try {
            this._isPrompting = true;
            const result = await showQuickPick(this._context, picks, options);
            this._onDidFinishPromptEmitter.fire({ value: result });
            return result;
        } finally {
            this._isPrompting = false;
        }
    }

    public async showInputBox(options: types.AzExtInputBoxOptions): Promise<string> {
        addStepTelemetry(this._context, options.stepName, 'inputBox', options.prompt);
        if (this._context.ui.wizard?.cancellationToken.isCancellationRequested) {
            throw new UserCancelledError();
        }
        try {
            this._isPrompting = true;
            const result = await showInputBox(this._context, options);
            this._onDidFinishPromptEmitter.fire({
                value: result,
                matchesDefault: result === options.value
            });
            return result;
        } finally {
            this._isPrompting = false;
        }
    }

    public async showOpenDialog(options: types.AzExtOpenDialogOptions): Promise<Uri[]> {
        addStepTelemetry(this._context, options.stepName, 'openDialog', options.title);
        if (this._context.ui.wizard?.cancellationToken.isCancellationRequested) {
            throw new UserCancelledError();
        }
        try {
            this._isPrompting = true;
            const result = await showOpenDialog(options);
            this._onDidFinishPromptEmitter.fire({ value: result });
            return result;
        } finally {
            this._isPrompting = false;
        }
    }

    public async showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    public async showWarningMessage<T extends MessageItem>(message: string, options: types.IAzureMessageOptions, ...items: T[]): Promise<T>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async showWarningMessage<T extends MessageItem>(message: string, ...args: any[]): Promise<T> {
        let stepName: string | undefined;
        const firstArg: unknown = args[0];
        if (typeof firstArg === 'object' && firstArg && 'stepName' in firstArg) {
            stepName = (<Partial<types.IAzureMessageOptions>>firstArg).stepName;
        }

        addStepTelemetry(this._context, stepName, 'warningMessage', message);
        if (this._context.ui.wizard?.cancellationToken.isCancellationRequested) {
            throw new UserCancelledError();
        }
        try {
            this._isPrompting = true;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const result = await showWarningMessage<T>(this._context, message, ...args);
            this._onDidFinishPromptEmitter.fire({ value: result });
            return result;
        } finally {
            this._isPrompting = false;
        }
    }
}

export function addStepTelemetry(context: IInternalActionContext, stepName: string | undefined, stepType: string, description: string | undefined): void {
    if (!stepName) {
        stepName = context.ui.wizard?.currentStepId;
    }

    if (!stepName) {
        stepName = description ? `${stepType}|${convertToStepName(description)}` : stepType;
    }

    context.telemetry.properties.lastStep = stepName;
}

function convertToStepName(prompt: string): string {
    return prompt.replace(/\s/g, '').slice(0, 20);
}
