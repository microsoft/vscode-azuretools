/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, EventEmitter, MessageItem, Uri } from 'vscode';
import * as types from '../../index';
import { IInternalActionContext, IInternalAzureWizard } from './IInternalActionContext';
import { showInputBox } from './showInputBox';
import { showOpenDialog } from './showOpenDialog';
import { showQuickPick } from './showQuickPick';
import { showWarningMessage } from './showWarningMessage';

export class AzExtUserInput implements types.IAzureUserInput {
    public wizard?: IInternalAzureWizard;
    private _onDidFinishPromptEmitter: EventEmitter<types.PromptResult> = new EventEmitter<types.PromptResult>();
    private _context: IInternalActionContext;

    public constructor(context: IInternalActionContext) {
        this._context = context;
    }

    public get onDidFinishPrompt(): Event<types.PromptResult> {
        return this._onDidFinishPromptEmitter.event;
    }

    public async showQuickPick<TPick extends types.IAzureQuickPickItem<unknown>>(picks: TPick[] | Promise<TPick[]>, options: types.IAzureQuickPickOptions): Promise<TPick | TPick[]> {
        addStepTelemetry(this._context, options.stepName, 'quickPick', options.placeHolder);
        const result = await showQuickPick(this._context, picks, options);
        this._onDidFinishPromptEmitter.fire({ value: result });
        return result;
    }

    public async showInputBox(options: types.AzExtInputBoxOptions): Promise<string> {
        addStepTelemetry(this._context, options.stepName, 'inputBox', options.prompt);
        const result = await showInputBox(this._context, options);
        this._onDidFinishPromptEmitter.fire({
            value: result,
            matchesDefault: result === options.value
        });
        return result;
    }

    public async showOpenDialog(options: types.AzExtOpenDialogOptions): Promise<Uri[]> {
        addStepTelemetry(this._context, options.stepName, 'openDialog', options.title);
        const result = await showOpenDialog(options);
        this._onDidFinishPromptEmitter.fire({ value: result });
        return result;
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
        const result = await showWarningMessage<T>(this._context, message, ...args);
        this._onDidFinishPromptEmitter.fire({ value: result });
        return result;
    }
}

function addStepTelemetry(context: IInternalActionContext, stepName: string | undefined, stepType: string, description: string | undefined): void {
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
