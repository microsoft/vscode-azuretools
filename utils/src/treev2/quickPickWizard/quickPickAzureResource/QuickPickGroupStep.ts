/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../../index';
import * as vscode from 'vscode';
import { GenericQuickPickStep, SkipIfOneQuickPickOptions } from '../GenericQuickPickStep';
import { AzureResourceQuickPickWizardContext, ResourceGroupsItem } from '../../../../hostapi.v2';
import { parseContextValue } from '../../../utils/contextUtils';

interface GroupQuickPickOptions extends SkipIfOneQuickPickOptions {
    groupType?: types.AzExtResourceType[];
    skipIfOne?: true;
}

export class QuickPickGroupStep extends GenericQuickPickStep<ResourceGroupsItem, AzureResourceQuickPickWizardContext, GroupQuickPickOptions> {
    public constructor(tdp: vscode.TreeDataProvider<unknown>, options: GroupQuickPickOptions) {
        super(
            tdp,
            {
                ...options,
                skipIfOne: true, // Group is always skip-if-one
            }
        );
    }

    protected isDirectPick(_node: vscode.TreeItem): boolean {
        // Group is never a direct pick
        return false;
    }

    protected isIndirectPick(node: vscode.TreeItem): boolean {
        const contextValues = parseContextValue(node.contextValue);

        return !this.pickOptions.groupType ||
            !contextValues.includes('azureResourceTypeGroup') ||
            this.pickOptions.groupType.some(groupType => contextValues.includes(groupType));
    }
}
