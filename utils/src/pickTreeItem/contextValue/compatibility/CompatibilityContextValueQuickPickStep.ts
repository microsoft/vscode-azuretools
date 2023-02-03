/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from "../../../../index";
import { ContextValueFilterQuickPickOptions, ContextValuePickFilter, ContextValueQuickPickStep } from "../ContextValueQuickPickStep";
import { getLastNode } from "../../getLastNode";
import { AzExtTreeItem } from "../../../tree/AzExtTreeItem";
import { AzExtParentTreeItem } from "../../../tree/AzExtParentTreeItem";
import { isAzExtParentTreeItem } from "../../../tree/isAzExtTreeItem";
import { TreeItem } from "vscode";
import { PickFilter } from "../../PickFilter";
import { isWrapper } from "@microsoft/vscode-azureresources-api";
import { localize } from "../../../localize";

/**
 * Provides compatability with {@link AzExtParentTreeItem.pickTreeItemImpl}
 */
export class CompatibilityContextValueQuickPickStep<TContext extends types.QuickPickWizardContext, TOptions extends ContextValueFilterQuickPickOptions> extends ContextValueQuickPickStep<TContext, TOptions> {

    public override async prompt(wizardContext: TContext): Promise<void> {
        this.setCustomPlaceholder(wizardContext);
        await this.provideCompatabilityWithPickTreeItemImpl(wizardContext) || await super.prompt(wizardContext);
    }

    protected override pickFilter: PickFilter<TreeItem> = new CompatibleContextValuePickFilter(this.pickOptions);

    /**
    * If the last picked item is an `AzExtParentTreeItem`
    * and has a `childTypeLabel` set, use that as the placeholder.
    */
    private setCustomPlaceholder(context: TContext): void {
        const lastPickedItem = getLastNode(context);
        const lastPickedItemUnwrapped = isWrapper(lastPickedItem) ? lastPickedItem.unwrap() : lastPickedItem;
        if (isAzExtParentTreeItem(lastPickedItemUnwrapped) && lastPickedItemUnwrapped.childTypeLabel) {
            this.promptOptions.placeHolder = localize('selectTreeItem', 'Select {0}', lastPickedItemUnwrapped.childTypeLabel);
        }
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

class CompatibleContextValuePickFilter extends ContextValuePickFilter {
    // For compatiblity, if the include option is a RegExp test the entire contextValue against it.
    override isFinalPick(node: TreeItem): boolean {
        const includeOption = this.pickOptions.contextValueFilter.include;
        if (includeOption instanceof RegExp && node.contextValue) {
            return includeOption.test(node.contextValue);
        }

        return super.isFinalPick(node);
    }
}
