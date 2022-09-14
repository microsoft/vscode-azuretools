/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../../index';
import * as vscode from 'vscode';
import { GenericQuickPickStep, SkipIfOneQuickPickOptions } from '../GenericQuickPickStep';
import { GroupingItem } from './tempTypes';
import { AzureResourceQuickPickWizardContext, ResourceGroupsItem } from '../../../../hostapi.v2';

interface GroupQuickPickOptions extends SkipIfOneQuickPickOptions {
    groupType?: types.AzExtResourceType[];
    skipIfOne?: true;
}

export class QuickPickGroupStep extends GenericQuickPickStep<ResourceGroupsItem, AzureResourceQuickPickWizardContext, GroupQuickPickOptions> {
    public constructor(tdp: vscode.TreeDataProvider<ResourceGroupsItem>, options: GroupQuickPickOptions) {
        super(
            tdp,
            {
                ...options,
                skipIfOne: true, // Group is always skip-if-one
            }
        );
    }

    protected isDirectPick(_node: GroupingItem): boolean {
        // Group is never a direct pick
        return false;
    }

    protected isIndirectPick(node: GroupingItem): boolean {
        return !node.resourceType || !this.pickOptions.groupType || this.pickOptions.groupType.includes(node.resourceType);
    }
}
