/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Box, ContextValueFilter, ContextValueFilterableTreeNode, ResourceGroupsItem } from "../../../../hostapi.v2";
import { AzureResourceQuickPickWizardContext } from "../quickPickAzureResource/AzureResourceQuickPickWizardContext";
import { QuickPickAppResourceStep } from "../quickPickAzureResource/QuickPickAppResourceStep";
import { QuickPickAzureSubscriptionStep } from "../quickPickAzureResource/QuickPickAzureSubscriptionStep";
import { QuickPickGroupStep } from "../quickPickAzureResource/QuickPickGroupStep";
import { RecursiveQuickPickStep } from "../RecursiveQuickPickStep";
import { AzureWizard } from "../../../wizard/AzureWizard";
import { getLastNode } from "../QuickPickWizardContext";
import { NoResourceFoundError } from "../../../errors";
import { AzureWizardPromptStep } from '../../../wizard/AzureWizardPromptStep';
import { AzExtResourceType } from '../../../AzExtResourceType';
import { IActionContext } from '../../../../index';

type Stamped<T, Stamp> = T & { _stamp: Stamp };
type MaybeStamped<T> = T | Stamped<T, unknown>;
type GetStamp<T> = T extends Stamped<unknown, infer Stamp> ? Stamp : unknown;

type PickDescendantOptions = { filter: ContextValueFilter };
type PickResourceOptions = { type: AzExtResourceType; };

interface TreeItemPickerBase<TPick = unknown> {
    run(context: IActionContext): Promise<TPick>;
}

export interface TreeItemPickerRoot {
    resource<Options extends MaybeStamped<PickResourceOptions>>(options: Options): TreeItemPickerWithDescendants<GetStamp<Options>>;
    descendant<Options extends MaybeStamped<PickDescendantOptions>>(options: Options): TreeItemPickerBase<GetStamp<Options>>;
}

interface TreeItemPickerWithDescendants<TPick = unknown> extends TreeItemPickerBase<TPick> {
    descendant<Options extends MaybeStamped<PickDescendantOptions>>(options: Options): TreeItemPickerBase<GetStamp<Options>>
}

class TreeItemPicker<TPick = unknown> implements TreeItemPickerRoot {

    private readonly promptSteps: AzureWizardPromptStep<AzureResourceQuickPickWizardContext>[] = [];

    constructor(private readonly treeDataProvider: vscode.TreeDataProvider<ContextValueFilterableTreeNode>) { }

    public resource<Options extends MaybeStamped<PickResourceOptions>>(options: Options): TreeItemPickerWithDescendants<GetStamp<Options>> {
        this.promptSteps.push(
            new QuickPickAzureSubscriptionStep(this.treeDataProvider),
            new QuickPickGroupStep(this.treeDataProvider, {
                groupType: options.type,
            }),
            new QuickPickAppResourceStep(this.treeDataProvider, {
                resourceType: options.type,
                skipIfOne: false,
            }),
        );

        return this as TreeItemPickerWithDescendants<GetStamp<Options>>;
    }

    public descendant<Options extends MaybeStamped<PickDescendantOptions>>(options: Options): TreeItemPickerBase<GetStamp<Options>> {
        this.promptSteps.push(new RecursiveQuickPickStep<ResourceGroupsItem, AzureResourceQuickPickWizardContext>(this.treeDataProvider, {
            contextValueFilter: options.filter,
            skipIfOne: false,
        }));

        return this as TreeItemPickerBase<GetStamp<Options>>;
    }

    public async run(context: IActionContext): Promise<TPick> {
        const wizardContext = context as AzureResourceQuickPickWizardContext;
        wizardContext.pickedNodes = [];

        const wizard = new AzureWizard(context, {
            hideStepCount: true,
            promptSteps: this.promptSteps,
        });

        await wizard.prompt();

        const lastPickedItem = getLastNode(wizardContext);

        if (!lastPickedItem) {
            throw new NoResourceFoundError(wizardContext);
        } else {
            return (lastPickedItem as unknown as Box).unwrap<TPick>();
        }
    }
}

export function createTreeItemPicker(treeDataProvider: vscode.TreeDataProvider<ContextValueFilterableTreeNode>): TreeItemPickerRoot {
    return new TreeItemPicker(treeDataProvider);
}
