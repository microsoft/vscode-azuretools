/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { UserCancelledError } from '../errors';
import { IQuickPickItemWithData } from './IQuickPickItemWithData';
import { WizardBase } from './WizardBase';

export abstract class WizardStep {
    protected readonly wizard: WizardBase;

    protected constructor(wizard: WizardBase) {
        this.wizard = wizard;
    }

    public abstract prompt(): Promise<void>;
    public abstract execute(): Promise<void>;

    get stepIndex(): number {
        return this.wizard.steps.indexOf(this);
    }

    get stepProgressText(): string {
        return `Step ${this.stepIndex + 1}/${this.wizard.steps.length}`;
    }

    public async showQuickPick<T>(items: IQuickPickItemWithData<T>[] | Thenable<IQuickPickItemWithData<T>[]>, options: vscode.QuickPickOptions, persistenceKey?: string, token?: vscode.CancellationToken): Promise<T> {
        options.ignoreFocusOut = true;
        items = await Promise.resolve(items);
        if (this.wizard.persistence && persistenceKey) {
            // See if the previous value selected by the user is in this list, and move it to the top as default
            const previousId: string | undefined = <string>this.wizard.persistence.get(persistenceKey);
            if (previousId) {
                const index: number = items.findIndex((item: IQuickPickItemWithData<T>) => item.persistenceId === previousId);
                if (index !== -1) {
                    const previousItem: IQuickPickItemWithData<T>[] = items.splice(index, 1);
                    items = previousItem.concat(items);
                }
            }
        }

        const result: IQuickPickItemWithData<T> | undefined = await vscode.window.showQuickPick(items, options, token);
        if (result === undefined) {
            throw new UserCancelledError();
        }

        if (this.wizard.persistence && persistenceKey) {
            this.wizard.persistence.update(persistenceKey, result.persistenceId);
        }

        return result.data;
    }

    public async showInputBox(options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Promise<string> {
        if (options === undefined) {
            options = {};
        }

        options.ignoreFocusOut = true;
        const result: string | undefined = await vscode.window.showInputBox(options, token);

        if (result === undefined) {
            throw new UserCancelledError();
        }

        return result;
    }
}
