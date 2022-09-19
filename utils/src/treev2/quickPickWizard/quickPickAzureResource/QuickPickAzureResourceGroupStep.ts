/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem } from "vscode";
import { AzureResourceQuickPickWizardContext, ResourceGroupsItem } from "../../../../hostapi.v2";
import * as types from "../../../../index";
import { GenericQuickPickOptions, GenericQuickPickStep } from "../GenericQuickPickStep";

// TODO: implement this for picking resource group
// The resource group may NOT be the grouping method used in the tree
export class QuickPickAzureResourceGroupStep extends GenericQuickPickStep<ResourceGroupsItem, AzureResourceQuickPickWizardContext, GenericQuickPickOptions> {
    protected override getPicks(_wizardContext: AzureResourceQuickPickWizardContext): Promise<types.IAzureQuickPickItem<ResourceGroupsItem>[]> {
        throw new Error("Method not implemented.");
    }

    protected isDirectPick(_node: TreeItem): boolean {
        throw new Error("Method not implemented.");
    }

    protected isIndirectPick(_node: TreeItem): boolean {
        throw new Error("Method not implemented.");
    }
}
