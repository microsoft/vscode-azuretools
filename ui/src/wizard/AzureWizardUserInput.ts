/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, InputBox, InputBoxOptions, QuickInputButtons, QuickPick, QuickPickItem, window } from 'vscode';
import * as types from '../../index';
import { GoBackError, UserCancelledError } from '../errors';
import { IWizardUserInput } from './IWizardUserInput';

export interface IInternalAzureWizard {
    title: string | undefined;
    currentStep: number;
    totalSteps: number;
    hideStepCount: boolean | undefined;
    getCachedInputBoxValue(): string | undefined;
}

type QuickPickGroup = {
    name?: string;
    isCollapsed?: boolean;
    picks: QuickPickItem[]
}

/**
 * Provides more advanced versions of vscode.window.showQuickPick and vscode.window.showInputBox for use in the AzureWizard
 */
export class AzureWizardUserInput implements IWizardUserInput {
    public isPrompting: boolean = false;

    private _wizard: IInternalAzureWizard;

    public constructor(wizard: IInternalAzureWizard) {
        this._wizard = wizard;
    }

    public get showBackButton(): boolean {
        return this._wizard.currentStep > 1;
    }

    private get _showTitle(): boolean {
        return this._wizard.totalSteps > 1;
    }

    public async showQuickPick<TPick extends QuickPickItem>(picks: TPick[] | Promise<TPick[]>, options: types.IAzureQuickPickOptions): Promise<TPick | TPick[]> {
        const disposables: Disposable[] = [];
        try {
            const quickPick: QuickPick<TPick> = window.createQuickPick<TPick>();
            disposables.push(quickPick);
            if (this._showTitle) {
                quickPick.title = this._wizard.title;
                if (!this._wizard.hideStepCount && this._wizard.title) {
                    quickPick.step = this._wizard.currentStep;
                    quickPick.totalSteps = this._wizard.totalSteps;
                }
            }

            quickPick.buttons = this.showBackButton ? [QuickInputButtons.Back] : [];

            // Copy settings that are common between options and quickPick
            quickPick.placeholder = options.loadingPlaceHolder || options.placeHolder;
            quickPick.ignoreFocusOut = !!options.ignoreFocusOut;
            quickPick.matchOnDescription = !!options.matchOnDescription;
            quickPick.matchOnDetail = !!options.matchOnDetail;
            quickPick.canSelectMany = !!options.canPickMany;

            const groups: QuickPickGroup[] = [];

            // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
            return await new Promise<TPick | TPick[]>(async (resolve, reject): Promise<void> => {
                disposables.push(
                    quickPick.onDidAccept(async () => {
                        try {
                            if (options.canPickMany) {
                                resolve(Array.from(quickPick.selectedItems));
                            } else {
                                const selectedItem = <TPick & Partial<types.IAzureQuickPickItem<unknown>>>quickPick.selectedItems[0];
                                const group = groups.find(g => selectedItem.data === g);
                                if (group) {
                                    group.isCollapsed = !group.isCollapsed;
                                    quickPick.items = this.getGroupedPicks(groups);

                                    // The active pick gets reset when we change the items, but we can explicitly set it here to persist the active state
                                    const newGroupPick = quickPick.items.find((i: Partial<types.IAzureQuickPickItem<unknown>>) => i.data === group);
                                    if (newGroupPick) {
                                        quickPick.activeItems = [newGroupPick];
                                    }
                                } else if (selectedItem.onPicked) {
                                    await selectedItem.onPicked();
                                } else {
                                    resolve(selectedItem);
                                }
                            }
                        } catch (error) {
                            reject(error);
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
                this.isPrompting = true;
                try {
                    quickPick.items = await this.initializePicks<TPick>(picks, options, groups);

                    if (groups.length > 0) {
                        // If grouping is enabled, make the first actual pick active by default, rather than the group label pick
                        quickPick.activeItems = [<TPick>groups[0].picks[0]];
                    }

                    if (options.canPickMany && options.isPickSelected) {
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        quickPick.selectedItems = quickPick.items.filter(p => options.isPickSelected!(p));
                    }
                    quickPick.placeholder = options.placeHolder;
                    quickPick.busy = false;
                    quickPick.enabled = true;
                } catch (err) {
                    reject(err);
                }
            });
        } finally {
            this.isPrompting = false;
            disposables.forEach(d => { d.dispose(); });
        }
    }

    private async initializePicks<TPick extends QuickPickItem>(picks: TPick[] | Promise<TPick[]>, options: types.IAzureQuickPickOptions, groups: QuickPickGroup[]): Promise<TPick[]> {
        picks = await picks;
        if (!options.enableGrouping) {
            return picks;
        } else {
            if (options.canPickMany) {
                throw new Error('Internal error: "canPickMany" and "enableGrouping" are not supported at the same time.')
            }

            for (const pick of picks) {
                const groupName: string | undefined = (<Partial<types.IAzureQuickPickItem<unknown>>>pick).group;
                const group = groups.find(g => g.name === groupName);
                if (group) {
                    group.picks.push(pick);
                } else {
                    groups.push({ name: groupName, picks: [pick] });
                }
            }
            return this.getGroupedPicks(groups);
        }
    }

    private getGroupedPicks<TPick extends QuickPickItem>(groups: QuickPickGroup[]): TPick[] {
        if (groups.length === 1) {
            // No point in grouping if there's only one group
            return <TPick[]>groups[0].picks;
        } else {
            const picks: QuickPickItem[] = [];
            for (const group of groups) {
                picks.push(<types.IAzureQuickPickItem<QuickPickGroup>>{
                    label: `$(chevron-${group.isCollapsed ? 'right' : 'down'}) ${group.name || ''}`,
                    data: group
                });
                if (!group.isCollapsed) {
                    picks.push(...group.picks);
                }
            }
            return <TPick[]>picks;
        }
    }

    public async showInputBox(options: InputBoxOptions): Promise<string> {
        const disposables: Disposable[] = [];
        try {
            const inputBox: InputBox = window.createInputBox();
            disposables.push(inputBox);
            if (this._showTitle) {
                inputBox.title = this._wizard.title;
                if (!this._wizard.hideStepCount && this._wizard.title) {
                    inputBox.step = this._wizard.currentStep;
                    inputBox.totalSteps = this._wizard.totalSteps;
                }
            }

            inputBox.buttons = this.showBackButton ? [QuickInputButtons.Back] : [];

            if (!inputBox.password) {
                inputBox.value = this._wizard.getCachedInputBoxValue() || options.value || '';
            }

            // Copy settings that are common between options and inputBox
            inputBox.ignoreFocusOut = !!options.ignoreFocusOut;
            inputBox.password = !!options.password;
            inputBox.placeholder = options.placeHolder;
            inputBox.prompt = options.prompt;

            let latestValidation: Promise<string | undefined | null> = options.validateInput ? Promise.resolve(options.validateInput(inputBox.value)) : Promise.resolve('');
            return await new Promise<string>((resolve, reject): void => {
                disposables.push(
                    inputBox.onDidChangeValue(async text => {
                        if (options.validateInput) {
                            const validation: Promise<string | undefined | null> = Promise.resolve(options.validateInput(text));
                            latestValidation = validation;
                            const message: string | undefined | null = await validation;
                            if (validation === latestValidation) {
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
                this.isPrompting = true;
            });
        } finally {
            this.isPrompting = false;
            disposables.forEach(d => { d.dispose(); });
        }
    }
}
