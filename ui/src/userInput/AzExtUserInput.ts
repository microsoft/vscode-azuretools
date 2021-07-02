/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, EventEmitter, InputBoxOptions, MessageItem, MessageOptions, OpenDialogOptions, QuickPickItem, Uri } from 'vscode';
import * as types from '../../index';
import { IInternalActionContext, IInternalAzureWizard } from './IInternalActionContext';
import { showInputBox } from './showInputBox';
import { showOpenDialog } from './showOpenDialog';
import { showQuickPick } from './showQuickPick';
import { showWarningMessage } from './showWarningMessage';

export class AzExtUserInput implements types.IAzureUserInput {
    public _onDidFinishPromptEmitter: EventEmitter<types.PromptResult> = new EventEmitter<types.PromptResult>();
    public wizard?: IInternalAzureWizard;
    private _context: IInternalActionContext;

    public constructor(context: IInternalActionContext) {
        this._context = context;
    }

    public get onDidFinishPrompt(): Event<types.PromptResult> {
        return this._onDidFinishPromptEmitter.event;
    }

    public async showQuickPick<TPick extends QuickPickItem>(picks: TPick[] | Promise<TPick[]>, options: types.IAzureQuickPickOptions): Promise<TPick | TPick[]> {
        const result = await showQuickPick(this._context, picks, options);
        this._onDidFinishPromptEmitter.fire({ value: result });
        return result;
    }

    public async showInputBox(options: InputBoxOptions): Promise<string> {
        const result = await showInputBox(this._context, options);
        this._onDidFinishPromptEmitter.fire({
            value: result,
            matchesDefault: result === options.value
        });
        return result;
    }

    public async showOpenDialog(options: OpenDialogOptions): Promise<Uri[]> {
        const result = await showOpenDialog(options);
        this._onDidFinishPromptEmitter.fire({ value: result });
        return result;
    }

    public async showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    public async showWarningMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Promise<T>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async showWarningMessage<T extends MessageItem>(message: string, ...args: any[]): Promise<T> {
        const result = await showWarningMessage<T>(this._context, message, ...args);
        this._onDidFinishPromptEmitter.fire({ value: result });
        return result;
    }
}
