/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Memento, MessageItem, MessageOptions, QuickPickItem } from 'vscode';
import * as types from '../index';
import { DialogResponses } from './DialogResponses';
import { GoBackError, UserCancelledError } from './errors';
import { localize } from './localize';
import { validOnTimeoutOrException } from './utils/inputValidation';
import { openUrl } from './utils/openUrl';
import { randomUtils } from './utils/randomUtils';
import { IRootUserInput, IWizardUserInput } from './wizard/IWizardUserInput';

export class AzureUserInput implements types.IAzureUserInput, types.AzureUserInput {
    public wizardUserInput: IWizardUserInput | undefined;
    private readonly _persistence: Memento;
    private _onDidFinishPromptEmitter: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();

    public constructor(persistence: Memento) {
        this._persistence = persistence;
    }

    public get onDidFinishPrompt(): vscode.Event<string> {
        return this._onDidFinishPromptEmitter.event;
    }

    private get _rootUserInput(): IRootUserInput {
        // If the current wizard is already prompting, that means the user started a new action outside the wizard and we should fall back to `vscode.window`
        // https://github.com/microsoft/vscode-azurefunctions/issues/1461
        return this.wizardUserInput && !this.wizardUserInput.isPrompting ? this.wizardUserInput : vscode.window;
    }

    public async showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: types.IAzureQuickPickOptions): Promise<T | T[]> {
        if (options.ignoreFocusOut === undefined) {
            options.ignoreFocusOut = true;
        }

        let persistenceKey: string | undefined;
        const unhashedKey: string | undefined = options.id || options.placeHolder;
        if (unhashedKey && !options.canPickMany) {
            persistenceKey = `showQuickPick.${randomUtils.getPseudononymousStringHash(unhashedKey)}`;
        }

        if (options.canPickMany && options.placeHolder) {
            options.placeHolder += localize('canPickManyInstructions', " (Press 'Space' to select and 'Enter' to confirm)");
        }

        const result: T | T[] | undefined = await this._rootUserInput.showQuickPick(this.getOrderedItems(items, persistenceKey, options.suppressPersistence), options);
        if (result === undefined) {
            throw new UserCancelledError();
        }

        if (!Array.isArray(result) && persistenceKey && !(<types.IAzureQuickPickItem><{}>result).suppressPersistence) {
            this._persistence.update(persistenceKey, getPersistenceValue(result));
        }

        this._onDidFinishPromptEmitter.fire();
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

        const result: string | undefined = await this._rootUserInput.showInputBox(options);
        if (result === undefined) {
            throw new UserCancelledError();
        } else {
            this._onDidFinishPromptEmitter.fire(result);
            return result;
        }
    }

    public showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    public showWarningMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Promise<MessageItem>;
    // tslint:disable-next-line:no-any
    public async showWarningMessage<T extends MessageItem>(message: string, ...args: any[]): Promise<T> {
        const learnMoreLink: string | undefined = args[0] && (<types.IAzureMessageOptions>args[0]).learnMoreLink;
        if (learnMoreLink) {
            args.push(DialogResponses.learnMore);
        }

        const back: MessageItem = { title: localize('back', 'Back') };
        if (this.wizardUserInput?.showBackButton) {
            args.push(back);
        }

        // tslint:disable-next-line: no-constant-condition
        while (true) {
            // tslint:disable-next-line:no-unsafe-any
            const result: T = await vscode.window.showWarningMessage(message, ...args);
            if (learnMoreLink && result === DialogResponses.learnMore) {
                await openUrl(learnMoreLink);
            } else if (result === undefined || result === DialogResponses.cancel) {
                throw new UserCancelledError();
            } else if (result === back) {
                throw new GoBackError();
            } else {
                this._onDidFinishPromptEmitter.fire();
                return result;
            }
        }
    }

    public async showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[]> {
        const result: vscode.Uri[] | undefined = await vscode.window.showOpenDialog(options);

        if (result === undefined || result.length === 0) {
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
                // No need to do anything if "recently used" item is not found or already the first item
                if (index > 0) {
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
