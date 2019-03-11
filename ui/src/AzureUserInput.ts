/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { InputBoxOptions, Memento, MessageItem, MessageOptions, QuickPickItem, QuickPickOptions } from 'vscode';
import * as types from '../index';
import { DialogResponses } from './DialogResponses';
import { UserCancelledError } from './errors';
import { localize } from './localize';
import { validOnTimeoutOrException } from './utils/inputValidation';
import { randomUtils } from './utils/randomUtils';

export interface IRootUserInput {
    showQuickPick<T extends QuickPickItem>(picks: T[] | Thenable<T[]>, options: QuickPickOptions): Thenable<T>;
    showInputBox(options: InputBoxOptions): Thenable<string | undefined>;
}

export class AzureUserInput implements types.IAzureUserInput, types.AzureUserInput {
    public rootUserInput: IRootUserInput = vscode.window;
    private readonly _persistence: Memento;

    public constructor(persistence: Memento) {
        this._persistence = persistence;
    }

    public async showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions): Promise<T | T[]> {
        if (options.ignoreFocusOut === undefined) {
            options.ignoreFocusOut = true;
        }

        let persistenceKey: string | undefined;
        const unhashedKey: string | undefined = (<types.IAzureQuickPickOptions>options).id || options.placeHolder;
        if (unhashedKey && !options.canPickMany) {
            persistenceKey = `showQuickPick.${randomUtils.getPseudononymousStringHash(unhashedKey)}`;
        }

        const result: T | T[] | undefined = await this.rootUserInput.showQuickPick(this.getOrderedItems(items, persistenceKey, (<types.IAzureQuickPickOptions>options).suppressPersistence), options);
        if (result === undefined) {
            throw new UserCancelledError();
        }

        if (!Array.isArray(result) && persistenceKey && !(<types.IAzureQuickPickItem><{}>result).suppressPersistence) {
            this._persistence.update(persistenceKey, getPersistenceValue(result));
        }

        return result;
    }

    public async showInputBox(options: vscode.InputBoxOptions): Promise<string> {
        if (options.ignoreFocusOut === undefined) {
            options.ignoreFocusOut = true;
        }

        // tslint:disable-next-line:typedef
        const validateInput = options.validateInput;
        if (validateInput) {
            options.validateInput = async (v): Promise<string | null | undefined> => validOnTimeoutOrException(async () => await validateInput(v));
        }

        const result: string | undefined = await this.rootUserInput.showInputBox(options);
        if (result === undefined) {
            throw new UserCancelledError();
        } else {
            return result;
        }
    }

    public showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    public showWarningMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Promise<MessageItem>;
    // tslint:disable-next-line:no-any
    public async showWarningMessage<T extends MessageItem>(message: string, ...args: any[]): Promise<T> {
        // tslint:disable-next-line:no-unsafe-any
        const result: T | undefined = await vscode.window.showWarningMessage(message, ...args);

        if (result === undefined || result === DialogResponses.cancel) {
            throw new UserCancelledError();
        } else {
            return result;
        }
    }

    public async showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[]> {
        const result: vscode.Uri[] | undefined = await vscode.window.showOpenDialog(options);

        if (result === undefined) {
            throw new UserCancelledError();
        } else {
            return result;
        }
    }

    /**
     * See if the previous value selected by the user is in the list, and move it to the top as default
     */
    private async getOrderedItems<T extends QuickPickItem>(items: T[] | Thenable<T[]>, persistenceKey: string | undefined, suppressPersistence: boolean | undefined): Promise<T[]> {
        items = await Promise.resolve(items);

        if (persistenceKey && !suppressPersistence) {
            const previousValue: string | undefined = this._persistence.get(persistenceKey);
            if (previousValue) {
                const index: number = items.findIndex((item: T) => getPersistenceValue(item) === previousValue);
                if (index !== -1) {
                    const previousItem: T = items.splice(index, 1)[0];

                    const recentlyUsed: string = localize('recentlyUsed', '(recently used)');
                    if (!previousItem.description) {
                        previousItem.description = recentlyUsed;
                    } else if (!previousItem.description.includes(recentlyUsed)) {
                        previousItem.description = `${previousItem.description} ${recentlyUsed}`;
                    }

                    items.unshift(previousItem);
                }
            }
        }

        return items;
    }
}

function getPersistenceValue(item: QuickPickItem): string {
    return randomUtils.getPseudononymousStringHash((<types.IAzureQuickPickItem>item).id || item.label);
}
