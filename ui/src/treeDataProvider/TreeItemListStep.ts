/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { NoResouceFoundError, NotImplementedError } from '../errors';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { AzureWizard } from '../wizard/AzureWizard';
import { AzureWizardPromptStep } from '../wizard/AzureWizardPromptStep';
import { AzExtParentTreeItem } from './AzExtParentTreeItem';
import { AzExtTreeItem } from './AzExtTreeItem';
import { isAzExtParentTreeItem } from './InternalInterfaces';
import { loadMoreLabel } from './treeConstants';

// tslint:disable: max-classes-per-file

type TreeItemPick = 'create' | 'createAdvanced' | AzExtTreeItem | AzExtTreeItem[];

type IntermediateTreeItemPick = 'loadMore' | TreeItemPick;

export class TreeItemListStep extends AzureWizardPromptStep<types.ITreeItemWizardContext> {
    public supportsDuplicateSteps: boolean = true;
    private _parent: AzExtParentTreeItem;
    private _expectedContextValue: types.IExpectedContextValue;
    private _pick?: TreeItemPick;

    public constructor(parent: AzExtParentTreeItem, expectedContextValue: types.IExpectedContextValue) {
        super();
        this._parent = parent;
        this._expectedContextValue = expectedContextValue;
    }

    public async prompt(context: types.ITreeItemWizardContext): Promise<void> {
        const placeHolder: string = localize('selectTreeItem', 'Select {0}', this._parent.childTypeLabel);
        const loadingPlaceHolder: string = localize('loading', 'Loading...');

        try {
            let loadMore: boolean = false;
            // tslint:disable-next-line: no-constant-condition
            while (true) {
                const result: IntermediateTreeItemPick = (await ext.ui.showQuickPick(this.getQuickPicks(this._parent, context, loadMore), { placeHolder, loadingPlaceHolder })).data;
                if (result === 'loadMore') {
                    loadMore = true;
                } else {
                    this._pick = result;
                    break;
                }
            }
        } catch (error) {
            // We want the loading thing to show for `showQuickPick` but we also need to support autoSelect and canPickMany based on the value of the picks
            // hence throwing an error instead of just awaiting `getQuickPicks`
            if (error instanceof AutoSelectError) {
                this._pick = error.data;
            } else if (error instanceof CanPickManyError) {
                this._pick = (await ext.ui.showQuickPick(error.picks, { placeHolder, canPickMany: true })).map(p => p.data);
            } else {
                throw error;
            }
        }
    }

    public shouldPrompt(context: types.ITreeItemWizardContext): boolean {
        return !context.pickedTreeItem;
    }

    public async getSubWizard(context: types.ITreeItemWizardContext): Promise<types.IWizardOptions<types.ITreeItemWizardContext> | undefined> {
        return await getSubwizardInternal(context, this._parent, this._expectedContextValue, this._pick);
    }

    private async getQuickPicks(treeItem: AzExtParentTreeItem, context: types.ITreeItemWizardContext, loadMore: boolean): Promise<types.IAzureQuickPickItem<IntermediateTreeItemPick>[]> {
        if (loadMore) {
            await treeItem.treeDataProvider.loadMore(treeItem, context);
        } else if (treeItem.onTreeItemPicked) {
            await treeItem.onTreeItemPicked(context);
        }

        let children: AzExtTreeItem[] = await treeItem.getCachedChildren(context);
        children = children.filter((ti: AzExtTreeItem) => ti.includeInTreePicker(this._expectedContextValue));

        const autoSelectInTreeItemPicker: boolean | undefined = treeItem.autoSelectInTreeItemPicker;
        const childrenPicks: types.IAzureQuickPickItem<AzExtTreeItem>[] = children.map((ti: AzExtTreeItem) => {
            return {
                label: ti.label,
                description: ti.description,
                id: ti.fullId,
                data: ti
            };
        });

        const picks: types.IAzureQuickPickItem<IntermediateTreeItemPick>[] = [...childrenPicks];
        if (treeItem.getCreateSubWizardImpl && treeItem.childTypeLabel && !context.suppressCreatePick) {
            const createNewLabel: string = treeItem.createNewLabel || localize('treePickerCreateNew', 'Create new {0}...', treeItem.childTypeLabel);

            if (treeItem.supportsAdvancedCreation) {
                picks.unshift({
                    label: `$(plus) ${createNewLabel}`,
                    description: localize('advanced', 'Advanced'),
                    data: 'createAdvanced'
                });
            }

            picks.unshift({
                label: `$(plus) ${createNewLabel}`,
                data: 'create'
            });
        }

        if (treeItem.hasMoreChildrenImpl()) {
            picks.push({
                label: `$(sync) ${loadMoreLabel}`,
                description: '',
                data: 'loadMore'
            });
        }

        if (picks.length === 0) {
            throw new NoResouceFoundError(context);
        } else if (picks.length === 1 && autoSelectInTreeItemPicker && picks[0].data !== 'loadMore') {
            throw new AutoSelectError(picks[0].data);
        } else if (context.canPickMany && children.some(c => c.matchesContextValue(this._expectedContextValue))) {
            // canPickMany is only supported at the last stage of the picker, so only throw treeItem.error if some of the picks match
            throw new CanPickManyError(childrenPicks);
        }

        return picks;
    }
}

async function getSubwizardInternal(context: types.ITreeItemWizardContext, parent: AzExtParentTreeItem, expectedContextValue: types.IExpectedContextValue, intermediatePick: TreeItemPick | undefined): Promise<types.IWizardOptions<types.ITreeItemWizardContext> | undefined> {
    if (intermediatePick === 'create' || intermediatePick === 'createAdvanced') {
        if (!parent.getCreateSubWizardImpl) {
            throw new NotImplementedError('getCreateSubWizardImpl', parent);
        }

        const advancedCreation: boolean = intermediatePick === 'createAdvanced';
        const options: types.IWizardOptions<types.ITreeItemWizardContext> = await parent.getCreateSubWizardImpl(context, advancedCreation);
        // tslint:disable-next-line: strict-boolean-expressions
        options.promptSteps = options.promptSteps || [];
        return {
            title: options.title,
            promptSteps: [...options.promptSteps, new TreeItemPickerPostCreateStep(parent, options)]
        };
    } else if (!intermediatePick) {
        // Only possible if `shouldPrompt` returned `false` and the item was already picked
        return undefined;
    } else if (Array.isArray(intermediatePick)) {
        context.pickedTreeItem = intermediatePick;
        return undefined;
    } else if (intermediatePick.matchesContextValue(expectedContextValue)) {
        context.pickedTreeItem = intermediatePick;
        if (intermediatePick.onTreeItemPicked) {
            await intermediatePick.onTreeItemPicked(context);
        }

        if (context.action === 'createChild' || context.action === 'createChildAdvanced') {
            const pickAsParentTi: AzExtParentTreeItem = <AzExtParentTreeItem>intermediatePick;
            if (!pickAsParentTi.getCreateSubWizardImpl) {
                throw new NotImplementedError('getCreateSubWizardImpl', pickAsParentTi);
            }

            const advancedCreation: boolean = context.action === 'createChildAdvanced';
            return await pickAsParentTi.getCreateSubWizardImpl(context, advancedCreation);
        }
        return undefined;
    } else if (isAzExtParentTreeItem(intermediatePick)) {
        const tiAsParent: AzExtParentTreeItem = <AzExtParentTreeItem>intermediatePick;
        return { promptSteps: [new TreeItemListStep(tiAsParent, expectedContextValue)] };
    } else {
        throw new NoResouceFoundError(context);
    }
}

class TreeItemPickerPostCreateStep<T extends types.IActionContext> extends AzureWizardPromptStep<types.ITreeItemWizardContext> {
    private _parent: AzExtParentTreeItem;
    private _options: types.IWizardOptions<T>;

    public constructor(parent: AzExtParentTreeItem, options: types.IWizardOptions<T>) {
        super();
        this._parent = parent;
        this._options = options;
    }

    public async prompt(_context: types.ITreeItemWizardContext): Promise<void> {
        // not possible
    }

    public shouldPrompt(_context: types.ITreeItemWizardContext): boolean {
        return false;
    }

    public async getSubWizard(context: types.ITreeItemWizardContext & T): Promise<types.IWizardOptions<types.ITreeItemWizardContext> | undefined> {
        const newWizard: AzureWizard<T> = new AzureWizard<T>(context, {
            executeSteps: this._options.executeSteps
        });

        const label: string = nonNullProp(context, 'newChildLabel');
        const treeItem: AzExtTreeItem = <AzExtTreeItem>await this._parent.withCreateProgress(label, async () => { // todo cast
            await newWizard.execute();
            return nonNullProp(context, 'newChildTreeItem');
        });

        return getSubwizardInternal(context, this._parent, { id: 'todo' }, treeItem);
    }
}

class AutoSelectError extends Error {
    public readonly data: TreeItemPick;
    constructor(data: TreeItemPick) {
        super();
        this.data = data;
    }
}

class CanPickManyError extends Error {
    public readonly picks: types.IAzureQuickPickItem<AzExtTreeItem>[];
    constructor(picks: types.IAzureQuickPickItem<AzExtTreeItem>[]) {
        super();
        this.picks = picks;
    }
}
