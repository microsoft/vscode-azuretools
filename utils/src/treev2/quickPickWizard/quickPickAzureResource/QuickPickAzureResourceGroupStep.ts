/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem } from "vscode";
import { AzureResourceQuickPickWizardContext } from "../../../../hostapi.v2";
import * as types from "../../../../index";
import { PickFilter } from "../common/PickFilter";
import { GenericQuickPickOptions, GenericQuickPickStep } from "../GenericQuickPickStep";

// TODO: implement this for picking resource group
// The resource group may NOT be the grouping method used in the tree
export class QuickPickAzureResourceGroupStep extends GenericQuickPickStep<AzureResourceQuickPickWizardContext, GenericQuickPickOptions> {
    protected override getPicks(_wizardContext: AzureResourceQuickPickWizardContext): Promise<types.IAzureQuickPickItem<unknown>[]> {
        throw new Error("Method not implemented.");
    }

    pickFilter: PickFilter<TreeItem>;
}
