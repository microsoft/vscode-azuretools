/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, QuickInputButton, QuickInputButtons, QuickPick, window } from 'vscode';
import * as types from '../../index';
import { AzExtQuickInputButtons } from '../constants';
import { GoBackError, UserCancelledError } from '../errors';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { openUrl } from '../utils/openUrl';
import { randomUtils } from '../utils/randomUtils';
import { IInternalActionContext } from './IInternalActionContext';

export async function showQuickPick<TPick extends types.IAzureQuickPickItem<unknown>>(context: IInternalActionContext, picks: TPick[] | Promise<TPick[]>, options: types.IAzureQuickPickOptions): Promise<TPick | TPick[]> {
    const disposables: Disposable[] = [];
    try {
        const quickPick: QuickPick<TPick> = createQuickPick(context, options);
        disposables.push(quickPick);

        const recentlyUsedKey: string | undefined = getRecentlyUsedKey(options);
        const groups: QuickPickGroup[] = [];

        // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
        const result = await new Promise<TPick | TPick[]>(async (resolve, reject): Promise<void> => {
            disposables.push(
                quickPick.onDidAccept(async () => {
                    try {
                        if (options.canPickMany) {
                            resolve(Array.from(quickPick.selectedItems));
                        } else {
                            const selectedItem: TPick | undefined = quickPick.selectedItems[0];
                            if (selectedItem) {
                                const group = groups.find(g => selectedItem.data === g);
                                if (group) {
                                    group.isCollapsed = !group.isCollapsed;
                                    quickPick.items = getGroupedPicks(groups);

                                    // The active pick gets reset when we change the items, but we can explicitly set it here to persist the active state
                                    const newGroupPick = quickPick.items.find(i => i.data === group);
                                    if (newGroupPick) {
                                        quickPick.activeItems = [newGroupPick];
                                    }
                                } else if (selectedItem.onPicked) {
                                    await selectedItem.onPicked();
                                } else {
                                    resolve(selectedItem);
                                }
                            }
                        }
                    } catch (error) {
                        reject(error);
                    }
                }),
                quickPick.onDidTriggerButton(async btn => {
                    if (btn === QuickInputButtons.Back) {
                        reject(new GoBackError());
                    } else if (btn === AzExtQuickInputButtons.LearnMore) {
                        await openUrl(nonNullProp(options, 'learnMoreLink'));
                        context.telemetry.properties.learnMoreStep = context.telemetry.properties.lastStep;
                    }
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
                quickPick.items = await initializePicks<TPick>(picks, options, groups, recentlyUsedKey);

                if (shouldDisplayGroups(groups)) {
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

        if (recentlyUsedKey && !Array.isArray(result) && !result.suppressPersistence) {
            await ext.context.globalState.update(recentlyUsedKey, getRecentlyUsedValue(result));
        }

        return result;
    } finally {
        disposables.forEach(d => { d.dispose(); });
    }
}

export function createQuickPick<TPick extends types.IAzureQuickPickItem<unknown>>(context: IInternalActionContext, options: types.IAzureQuickPickOptions): QuickPick<TPick> {
    const quickPick: QuickPick<TPick> = window.createQuickPick<TPick>();

    const wizard = context.ui.wizard;
    if (wizard && wizard.showTitle) {
        quickPick.title = wizard.title;
        if (!wizard.hideStepCount && wizard.title) {
            quickPick.step = wizard.currentStep;
            quickPick.totalSteps = wizard.totalSteps;
        }
    }
    const buttons: QuickInputButton[] = [];
    if (wizard?.showBackButton) {
        buttons.push(QuickInputButtons.Back);
    }

    if (options.learnMoreLink) {
        buttons.push(AzExtQuickInputButtons.LearnMore);
    }

    quickPick.buttons = buttons;

    if (options.ignoreFocusOut === undefined) {
        options.ignoreFocusOut = true;
    }

    if (options.canPickMany && options.placeHolder) {
        options.placeHolder += localize('canPickManyInstructions', " (Press 'Space' to select and 'Enter' to confirm)");
    }

    // Copy settings that are common between options and quickPick
    quickPick.placeholder = options.loadingPlaceHolder || options.placeHolder;
    quickPick.ignoreFocusOut = !!options.ignoreFocusOut;
    quickPick.matchOnDescription = !!options.matchOnDescription;
    quickPick.matchOnDetail = !!options.matchOnDetail;
    quickPick.canSelectMany = !!options.canPickMany;
    return quickPick;
}

function getRecentlyUsedKey(options: types.IAzureQuickPickOptions): string | undefined {
    let recentlyUsedKey: string | undefined;
    const unhashedKey: string | undefined = options.id || options.placeHolder;
    if (unhashedKey && !options.canPickMany) {
        recentlyUsedKey = `showQuickPick.${randomUtils.getPseudononymousStringHash(unhashedKey)}`;
    }
    return recentlyUsedKey;
}

async function initializePicks<TPick extends types.IAzureQuickPickItem<unknown>>(picks: TPick[] | Promise<TPick[]>, options: types.IAzureQuickPickOptions, groups: QuickPickGroup[], recentlyUsedKey: string | undefined): Promise<TPick[]> {
    picks = await picks;

    if (recentlyUsedKey && !options.suppressPersistence) {
        bumpRecentlyUsedPick(picks, recentlyUsedKey);
    }

    if (picks.length === 0) {
        if (options.noPicksMessage) {
            picks.push(<TPick><unknown>{ label: options.noPicksMessage, suppressPersistence: true, onPicked: async () => { /* do nothing */ } });
        }
        return picks;
    } else if (!options.enableGrouping) {
        return picks;
    } else {
        if (options.canPickMany) {
            throw new Error('Internal error: "canPickMany" and "enableGrouping" are not supported at the same time.')
        }

        for (const pick of picks) {
            const groupName: string | undefined = pick.group;
            const group = groups.find(g => g.name === groupName);
            if (group) {
                group.picks.push(pick);
            } else {
                groups.push({ name: groupName, picks: [pick] });
            }
        }
        return getGroupedPicks(groups);
    }
}

function bumpRecentlyUsedPick<T extends types.IAzureQuickPickItem<unknown>>(picks: T[], recentlyUsedKey: string): void {
    const recentlyUsedValue: string | undefined = ext.context.globalState.get(recentlyUsedKey);
    if (recentlyUsedValue) {
        const index = picks.findIndex(p => getRecentlyUsedValue(p) === recentlyUsedValue);
        // No need to do anything if "recently used" item is not found or already the first item
        if (index > 0) {
            const previousItem: T = picks.splice(index, 1)[0];
            if (!previousItem.suppressPersistence) {
                const recentlyUsed: string = localize('recentlyUsed', '(recently used)');
                if (!previousItem.description) {
                    previousItem.description = recentlyUsed;
                } else if (!previousItem.description.includes(recentlyUsed)) {
                    previousItem.description = `${previousItem.description} ${recentlyUsed}`;
                }

                picks.unshift(previousItem);
            }
        }
    }
}

function getGroupedPicks<TPick extends types.IAzureQuickPickItem<unknown>>(groups: QuickPickGroup[]): TPick[] {
    let picks: types.IAzureQuickPickItem<unknown>[] = [];
    if (shouldDisplayGroups(groups)) {
        for (const group of groups) {
            if (!group.name) {
                picks.push(...group.picks);
            } else {
                picks.push({
                    label: `$(chevron-${group.isCollapsed ? 'right' : 'down'}) ${group.name}`,
                    data: group
                });
                if (!group.isCollapsed) {
                    picks.push(...group.picks);
                }
            }
        }
    } else {
        picks = picks.concat(...groups.map(g => g.picks));
    }
    return <TPick[]>picks;
}

function shouldDisplayGroups(groups: QuickPickGroup[]): boolean {
    return groups.filter(g => g.name).length > 1;
}

type QuickPickGroup = {
    name?: string;
    isCollapsed?: boolean;
    picks: types.IAzureQuickPickItem<unknown>[]
}

function getRecentlyUsedValue(item: types.IAzureQuickPickItem<unknown>): string {
    return randomUtils.getPseudononymousStringHash(item.id || item.label);
}
