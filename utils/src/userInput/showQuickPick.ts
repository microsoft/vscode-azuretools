/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, l10n, Memento, QuickInputButton, QuickInputButtons, QuickPick, QuickPickItemKind, window } from 'vscode';
import * as types from '../../index';
import { AzExtQuickInputButtons } from '../constants';
import { GoBackError, UserCancelledError } from '../errors';
import { ext } from '../extensionVariables';
import { nonNullProp } from '../utils/nonNull';
import { openUrl } from '../utils/openUrl';
import { randomUtils } from '../utils/randomUtils';
import { IInternalActionContext } from './IInternalActionContext';

// Picks are shown in given order, except higher priority items and recently used are moved to the top, and items are grouped if requiested
export async function showQuickPick<TPick extends types.IAzureQuickPickItem<unknown>>(context: IInternalActionContext, picks: TPick[] | Promise<TPick[]>, options: types.IAzureQuickPickOptions): Promise<TPick | TPick[]> {
    const disposables: Disposable[] = [];
    try {
        const quickPick: QuickPick<TPick> = createQuickPick(context, options);
        disposables.push(quickPick);

        const recentlyUsedKey: string | undefined = await getRecentlyUsedKey(options);
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
                                if (selectedItem.onPicked) {
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
                quickPick.items = await createQuickPickItems<TPick>(picks, options, groups, recentlyUsedKey);

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
            const recentlyUsedValue = await getRecentlyUsedValue(result);
            await ext.context.globalState.update(recentlyUsedKey, recentlyUsedValue);
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
        options.placeHolder += l10n.t(" (Press 'Space' to select and 'Enter' to confirm)");
    }

    // Copy settings that are common between options and quickPick
    quickPick.placeholder = options.loadingPlaceHolder || options.placeHolder;
    quickPick.ignoreFocusOut = !!options.ignoreFocusOut;
    quickPick.matchOnDescription = !!options.matchOnDescription;
    quickPick.matchOnDetail = !!options.matchOnDetail;
    quickPick.canSelectMany = !!options.canPickMany;
    return quickPick;
}

async function getRecentlyUsedKey(options: types.IAzureQuickPickOptions): Promise<string | undefined> {
    let recentlyUsedKey: string | undefined;
    const unhashedKey: string | undefined = options.id || options.placeHolder;
    if (unhashedKey && !options.canPickMany) {
        const hashKey = await randomUtils.getPseudononymousStringHash(unhashedKey);
        recentlyUsedKey = `showQuickPick.${hashKey}`;
    }
    return recentlyUsedKey;
}

// Exported for testing. globalState should be undefined except for testing.
export async function createQuickPickItems<TPick extends types.IAzureQuickPickItem<unknown>>(picks: TPick[] | Promise<TPick[]>, options: types.IAzureQuickPickOptions, groups: QuickPickGroup[], recentlyUsedKey: string | undefined, globalState: Memento | undefined = undefined): Promise<TPick[]> {
    picks = await picks;
    globalState ??= ext.context.globalState;

    picks = await bumpHighPriorityAndRecentlyUsed(picks, globalState, !!options.suppressPersistence, recentlyUsedKey);

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

async function bumpHighPriorityAndRecentlyUsed<T extends types.IAzureQuickPickItem<unknown>>(picks: T[], globalState: Memento, suppressPersistance: boolean, recentlyUsedKey: string | undefined): Promise<T[]> {
    const recentlyUsedValue: string | undefined = (suppressPersistance || !recentlyUsedKey) ? undefined : globalState.get(recentlyUsedKey);
    let recentlyUsedIndex: number = -1;
    if (recentlyUsedValue) {
        recentlyUsedIndex = await asyncFindIndex(picks, async p => await getRecentlyUsedValue(p) === recentlyUsedValue);

        // Update recently used item's description
        if (recentlyUsedIndex >= 0) {
            const recentlyUsedItem: T = picks[recentlyUsedIndex];
            if (!recentlyUsedItem.suppressPersistence) {
                const recentlyUsed: string = l10n.t('(recently used)');
                if (!recentlyUsedItem.description) {
                    recentlyUsedItem.description = recentlyUsed;
                } else if (!recentlyUsedItem.description.includes(recentlyUsed)) {
                    recentlyUsedItem.description = `${recentlyUsedItem.description} ${recentlyUsed}`;
                }
            } else {
                recentlyUsedIndex = -1;
            }
        }
    }

    return stableSortPicks(picks, recentlyUsedIndex);
}

function stableSortPicks<T extends types.IAzureQuickPickItem<unknown>>(picks: T[], recentlyUsedIndex: number): T[] {
    function getPriorityAsNumber(pick: types.IAzureQuickPickItem<unknown>, index: number): number {
        switch (pick.priority) {
            case 'highest':
                return recentlyUsedIndex === index ? 0 : 1;
            case 'normal':
            default:
                return recentlyUsedIndex === index ? 2 : 3;
        }
    }

    const sortableFacade: [index: number, priority: number][] = picks.map((pick, index) => [index, getPriorityAsNumber(pick, index)]);

    // Sort by priority
    // Note that since ES10, Array.sort is stable
    sortableFacade.sort((a, b) => a[1] - b[1]);

    // Reconstitute array by pulling out items by index
    const sortedPicks = sortableFacade.map(item => picks[item[0]]);
    return sortedPicks;
}

function getGroupedPicks<TPick extends types.IAzureQuickPickItem<unknown>>(groups: QuickPickGroup[]): TPick[] {
    let picks: types.IAzureQuickPickItem<unknown>[] = [];
    if (shouldDisplayGroups(groups)) {
        for (const group of groups) {
            if (!group.name) {
                picks.push(...group.picks);
            } else {
                picks.push({
                    label: group.name,
                    kind: QuickPickItemKind.Separator,
                    data: group
                });
                picks.push(...group.picks);
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

async function getRecentlyUsedValue(item: types.IAzureQuickPickItem<unknown>): Promise<string> {
    return await randomUtils.getPseudononymousStringHash(item.id || item.label);
}

// Signature of the callback
type CallBackFindIndex<T> = (
    value: T,
    index?: number,
    collection?: T[]
) => Promise<boolean>;

/**
 * Async FindIndex function
 *
 * @export
 * @template T
 * @param {T[]} elements
 * @param {CallBackFind<T>} cb
 * @returns {Promise<number>}
 */
async function asyncFindIndex<T>(elements: T[], cb: CallBackFindIndex<T>): Promise<number> {
    for (const [index, element] of elements.entries()) {
        if (await cb(element, index, elements)) {
            return index;
        }
    }

    return -1;
}
