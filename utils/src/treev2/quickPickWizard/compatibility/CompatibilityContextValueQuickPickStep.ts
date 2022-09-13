/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isBox, AzExtTreeItem, AzExtParentTreeItem } from "../../../..";
import { ContextValueFilter, ContextValueFilterableTreeNode } from "../../../../hostapi.v2";
import { isAzExtParentTreeItem } from "../../../tree/InternalInterfaces";
import { ContextValueQuickPickStep } from "../ContextValueQuickPickStep";
import { QuickPickWizardContext, getLastNode } from "../QuickPickWizardContext";
import { CompatibilityGenericQuickPickOptions } from "./CompatibilityGenericQuickPickStep";

export type CompatibilityContextValueFilterQuickPickOptions = CompatibilityGenericQuickPickOptions & {
    contextValueFilter: ContextValueFilter;
}

export class CompatibilityContextValueQuickPickStep<TNode extends ContextValueFilterableTreeNode, TContext extends QuickPickWizardContext<TNode>, TOptions extends CompatibilityContextValueFilterQuickPickOptions> extends ContextValueQuickPickStep<TNode, TContext, TOptions> {

    public override async prompt(wizardContext: TContext): Promise<void> {
        await this.provideCompatabilityWithPickTreeItemImpl(wizardContext) || await super.prompt(wizardContext);
    }

    private async provideCompatabilityWithPickTreeItemImpl(wizardContext: TContext): Promise<boolean> {
        const lastPickedItem = getLastNode(wizardContext);
        const lastPickedItemUnwrapped = isBox(lastPickedItem) ? lastPickedItem.unwrap() : lastPickedItem
        if (isAzExtParentTreeItem(lastPickedItemUnwrapped)) {
            const children = await this.treeDataProvider.getChildren(lastPickedItem);
            if (children && children.length) {
                const customChild = await this.getCustomChildren(wizardContext, lastPickedItemUnwrapped);

                const customPick = children.find((child) => {
                    const ti: AzExtTreeItem = isBox(child) ? child.unwrap<AzExtTreeItem>() : child as AzExtTreeItem;
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
