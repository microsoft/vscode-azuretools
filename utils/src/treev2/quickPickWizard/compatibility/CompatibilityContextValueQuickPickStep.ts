/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from "../../../../index";
import { isAzExtParentTreeItem } from "../../../tree/InternalInterfaces";
import { ContextValueQuickPickStep } from "../ContextValueQuickPickStep";
import { getLastNode } from "../QuickPickWizardContext";
import { AzExtTreeItem } from "../../../tree/AzExtTreeItem";
import { AzExtParentTreeItem } from "../../../tree/AzExtParentTreeItem";
import { GenericQuickPickOptions } from "../GenericQuickPickStep";
import { isWrapper } from "../../../registerCommandWithTreeNodeUnwrapping";

export interface CompatibilityContextValueFilterQuickPickOptions extends GenericQuickPickOptions {
    contextValueFilter: types.ContextValueFilter;
}

export class CompatibilityContextValueQuickPickStep<TNode extends types.ContextValueFilterableTreeNode, TContext extends types.QuickPickWizardContext<TNode>, TOptions extends CompatibilityContextValueFilterQuickPickOptions> extends ContextValueQuickPickStep<TNode, TContext, TOptions> {

    public override async prompt(wizardContext: TContext): Promise<void> {
        await this.provideCompatabilityWithPickTreeItemImpl(wizardContext) || await super.prompt(wizardContext);
    }

    private async provideCompatabilityWithPickTreeItemImpl(wizardContext: TContext): Promise<boolean> {
        const lastPickedItem = getLastNode(wizardContext);
        const lastPickedItemUnwrapped = isWrapper(lastPickedItem) ? lastPickedItem.unwrap() : lastPickedItem
        if (isAzExtParentTreeItem(lastPickedItemUnwrapped)) {
            const children = await this.treeDataProvider.getChildren(lastPickedItem);
            if (children && children.length) {
                const customChild = await this.getCustomChildren(wizardContext, lastPickedItemUnwrapped);

                const customPick = children.find((child) => {
                    const ti: AzExtTreeItem = isWrapper(child) ? child.unwrap() as AzExtTreeItem : child as AzExtTreeItem;
                    return ti.fullId === customChild?.fullId;
                });

                if (customPick) {
                    wizardContext.pickedNodes.push(customPick);
                    return true;
                }
            }
        }
        return false;
    }

    private async getCustomChildren(context: TContext, node: AzExtParentTreeItem): Promise<AzExtTreeItem | undefined> {
        return await node.pickTreeItemImpl?.(Array.isArray(this.pickOptions.contextValueFilter.include) ? this.pickOptions.contextValueFilter.include : [this.pickOptions.contextValueFilter.include], context);
    }
}
