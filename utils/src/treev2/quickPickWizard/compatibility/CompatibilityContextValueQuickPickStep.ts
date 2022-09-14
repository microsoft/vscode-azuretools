/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from "../../../../index";
import { isAzExtParentTreeItem } from "../../../tree/InternalInterfaces";
import { ContextValueFilterQuickPickOptions, ContextValueQuickPickStep } from "../ContextValueQuickPickStep";
import { getLastNode } from "../QuickPickWizardContext";
import { AzExtTreeItem } from "../../../tree/AzExtTreeItem";
import { AzExtParentTreeItem } from "../../../tree/AzExtParentTreeItem";
import { isWrapper } from "../../../registerCommandWithTreeNodeUnwrapping";

/**
 * Provides compatability with {@link AzExtParentTreeItem.pickTreeItemImpl}
 */
export class CompatibilityContextValueQuickPickStep<TNode extends types.CompatibleContextValueFilterableTreeNode, TContext extends types.QuickPickWizardContext<TNode>, TOptions extends ContextValueFilterQuickPickOptions> extends ContextValueQuickPickStep<TNode, TContext, TOptions> {

    public override async prompt(wizardContext: TContext): Promise<void> {
        await this.provideCompatabilityWithPickTreeItemImpl(wizardContext) || await super.prompt(wizardContext);
    }

    /**
     * Mimics how the legacy {@link AzExtParentTreeItem.pickChildTreeItem}
     * uses {@link AzExtParentTreeItem.pickTreeItemImpl} to customize the tree item picker.
     *
     * An example customization is skipping having to pick a UI-only node (ex: App Settings parent node)
     */
    private async provideCompatabilityWithPickTreeItemImpl(wizardContext: TContext): Promise<boolean> {
        const lastPickedItem = getLastNode(wizardContext);
        const lastPickedItemUnwrapped = isWrapper(lastPickedItem) ? lastPickedItem.unwrap() : lastPickedItem;
        if (isAzExtParentTreeItem(lastPickedItemUnwrapped)) {
            const children = await this.treeDataProvider.getChildren(lastPickedItem);
            if (children && children.length) {
                const customChild = await this.getCustomChildren(wizardContext, lastPickedItemUnwrapped);

                const customPick = children.find((child) => {
                    const ti: AzExtTreeItem = isWrapper(child) ? child.unwrap() : child as unknown as AzExtTreeItem;
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
