/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Memento, QuickPickItem, QuickPickOptions } from 'vscode';
import * as vscode from 'vscode';
import { IAzureQuickPickItem, IAzureQuickPickOptions, IAzureUserInput } from '../index';
import { DialogResponses } from './DialogResponses';
import { UserCancelledError } from './errors';
import { localize } from './localize';
import { randomUtils } from './utils/randomUtils';

export class AzureUserInput implements IAzureUserInput {
    private readonly _persistence: Memento;

    public constructor(persistence: Memento) {
        this._persistence = persistence;
    }

    public async showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions): Promise<T> {
        if (options.ignoreFocusOut === undefined) {
            options.ignoreFocusOut = true;
        }

        let persistenceKey: string | undefined;
        const hashData: string | undefined = (<IAzureQuickPickOptions>options).id || options.placeHolder;
        if (hashData) {
            persistenceKey = `showQuickPick.${randomUtils.getPseudononymousStringHash(hashData)}`;
        }

        const result: T | undefined = await vscode.window.showQuickPick(this.getOrderedItems(items, persistenceKey), options);
        if (result === undefined) {
            throw new UserCancelledError();
        }

        if (persistenceKey) {
            this._persistence.update(persistenceKey, getPersistenceValue(result));
        }

        return result;
    }

    public async showInputBox(options: vscode.InputBoxOptions): Promise<string> {
        const result: string | undefined = await vscode.window.showInputBox(options);

        if (result === undefined) {
            throw new UserCancelledError();
        } else {
            return result;
        }
    }

    public async showWarningMessage(message: string, ...items: vscode.MessageItem[]): Promise<vscode.MessageItem> {
        const result: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(message, ...items);
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
    private async getOrderedItems<T extends QuickPickItem>(items: T[] | Thenable<T[]>, persistenceKey: string | undefined): Promise<T[]> {
        items = await Promise.resolve(items);

        if (persistenceKey) {
            const previousValue: string | undefined = this._persistence.get(persistenceKey);
            if (previousValue) {
                const index: number = items.findIndex((item: T) => getPersistenceValue(item) === previousValue);
                if (index !== -1) {
                    const previousItem: T = items.splice(index, 1)[0];

                    const recentlyUsed: string = localize('recentlyUsed', '(recently used)');
                    if (!previousItem.description) {
                        previousItem.description = recentlyUsed;
                    } else if (!previousItem.detail) {
                        previousItem.detail = recentlyUsed;
                    }

                    items.unshift(previousItem);
                }
            }
        }

        return items;
    }
}

function getPersistenceValue(item: QuickPickItem): string {
    return randomUtils.getPseudononymousStringHash((<IAzureQuickPickItem>item).id || item.label);
}
