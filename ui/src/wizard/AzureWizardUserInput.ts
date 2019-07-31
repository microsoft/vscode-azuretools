/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, InputBox, InputBoxOptions, QuickInputButtons, QuickPick, QuickPickItem, window } from 'vscode';
import * as types from '../../index';
import { GoBackError, UserCancelledError } from '../errors';
import { IRootUserInput } from '../extensionVariables';

export interface IInternalAzureWizard {
    title: string | undefined;
    currentStep: number;
    totalSteps: number;
    hideStepCount: boolean | undefined;
}

/**
 * Provides more advanced versions of vscode.window.showQuickPick and vscode.window.showInputBox for use in the AzureWizard
 */
export class AzureWizardUserInput implements IRootUserInput {
    private _wizard: IInternalAzureWizard;

    public constructor(wizard: IInternalAzureWizard) {
        this._wizard = wizard;
    }

    public async showQuickPick<TPick extends QuickPickItem>(picks: TPick[] | Promise<TPick[]>, options: types.IAzureQuickPickOptions): Promise<TPick | TPick[]> {
        const disposables: Disposable[] = [];
        try {
            const quickPick: QuickPick<TPick> = window.createQuickPick<TPick>();
            disposables.push(quickPick);
            quickPick.title = this._wizard.title;
            if (!this._wizard.hideStepCount && this._wizard.title) {
                quickPick.step = this._wizard.currentStep;
                quickPick.totalSteps = this._wizard.totalSteps;
            }
            quickPick.buttons = this._wizard.currentStep > 1 ? [QuickInputButtons.Back] : [];

            // Copy settings that are common between options and quickPick
            quickPick.placeholder = options.placeHolder;
            quickPick.ignoreFocusOut = !!options.ignoreFocusOut;
            quickPick.matchOnDescription = !!options.matchOnDescription;
            quickPick.matchOnDetail = !!options.matchOnDetail;
            quickPick.canSelectMany = !!options.canPickMany;

            return await new Promise<TPick | TPick[]>(async (resolve, reject): Promise<void> => {
                disposables.push(
                    quickPick.onDidAccept(() => {
                        if (options.canPickMany) {
                            resolve(Array.from(quickPick.selectedItems));
                        } else {
                            resolve(quickPick.selectedItems[0]);
                        }
                    }),
                    quickPick.onDidTriggerButton(_btn => {
                        // Only back button is supported for now
                        reject(new GoBackError());
                    }),
                    quickPick.onDidHide(() => {
                        reject(new UserCancelledError());
                    })
                );

                // Show progress bar while loading quick picks
                quickPick.busy = true;
                quickPick.enabled = false;
                quickPick.show();
                try {
                    quickPick.items = await Promise.resolve(picks);
                    if (options.canPickMany && options.isPickSelected) {
                        // tslint:disable-next-line: no-non-null-assertion
                        quickPick.selectedItems = quickPick.items.filter(p => options.isPickSelected!(p));
                    }
                    quickPick.busy = false;
                    quickPick.enabled = true;
                } catch (err) {
                    reject(err);
                }
            });
        } finally {
            disposables.forEach(d => { d.dispose(); });
        }
    }

    public async showInputBox(options: InputBoxOptions): Promise<string> {
        const disposables: Disposable[] = [];
        try {
            const inputBox: InputBox = window.createInputBox();
            disposables.push(inputBox);
            inputBox.title = this._wizard.title;
            if (!this._wizard.hideStepCount && this._wizard.title) {
                inputBox.step = this._wizard.currentStep;
                inputBox.totalSteps = this._wizard.totalSteps;
            }
            inputBox.buttons = this._wizard.currentStep > 1 ? [QuickInputButtons.Back] : [];

            // Copy settings that are common between options and inputBox
            // tslint:disable-next-line: strict-boolean-expressions
            inputBox.value = options.value || '';
            inputBox.ignoreFocusOut = !!options.ignoreFocusOut;
            inputBox.password = !!options.password;
            inputBox.placeholder = options.placeHolder;
            inputBox.prompt = options.prompt;

            let latestValidation: Promise<string | undefined | null> = options.validateInput ? Promise.resolve(options.validateInput('')) : Promise.resolve('');
            return await new Promise<string>((resolve, reject): void => {
                disposables.push(
                    inputBox.onDidChangeValue(async text => {
                        if (options.validateInput) {
                            const validation: Promise<string | undefined | null> = Promise.resolve(options.validateInput(text));
                            latestValidation = validation;
                            const message: string | undefined | null = await validation;
                            if (validation === latestValidation) {
                                // tslint:disable-next-line: strict-boolean-expressions
                                inputBox.validationMessage = message || '';
                            }
                        }
                    }),
                    inputBox.onDidAccept(async () => {
                        // Run final validation and resolve if value passes
                        inputBox.enabled = false;
                        inputBox.busy = true;
                        const message: string | undefined | null = await latestValidation;
                        if (!message) {
                            resolve(inputBox.value);
                        } else {
                            inputBox.validationMessage = message;
                        }
                        inputBox.enabled = true;
                        inputBox.busy = false;
                    }),
                    inputBox.onDidTriggerButton(_btn => {
                        // Only back button is supported for now
                        reject(new GoBackError());
                    }),
                    inputBox.onDidHide(() => {
                        reject(new UserCancelledError());
                    })
                );
                inputBox.show();
            });
        } finally {
            disposables.forEach(d => { d.dispose(); });
        }
    }
}
