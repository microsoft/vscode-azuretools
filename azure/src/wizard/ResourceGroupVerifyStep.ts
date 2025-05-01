/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from '@azure/arm-resources';
import { ActivityChildItem, ActivityChildType, activityFailContext, activityFailIcon, AzureWizardExecuteStepWithActivityOutput, createContextValue, ExecuteActivityOutput, nonNullProp, parseError } from '@microsoft/vscode-azext-utils';
import { v4 as uuidv4 } from "uuid";
import { l10n, Progress, TreeItemCollapsibleState } from 'vscode';
import * as types from '../../index';
import { createResourcesClient } from '../clients';
import { ext } from '../extensionVariables';

export class ResourceGroupVerifyStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStepWithActivityOutput<T> {
    public priority: number = 95;
    public stepName: string = 'resourceGroupVerifyStep';
    private error: unknown;

    protected getOutputLogFail = (context: T) => l10n.t('Failed to verify whether resource group with name "{0}" already exists.', nonNullProp(context, 'newResourceGroupName'));
    protected getOutputLogSuccess(context: T) {
        return context.resourceGroup?.name ?
            l10n.t('Verified resource group with name "{0}" already exists.  Using existing resource group.', context.resourceGroup.name) :
            l10n.t('Verified resource group with name "{0}" is available for creation.', nonNullProp(context, 'newResourceGroupName'));
    }
    protected getTreeItemLabel(context: T) {
        return context.resourceGroup?.name ?
            l10n.t('Verify resource group "{0}" (exists)', context.resourceGroup.name) :
            l10n.t('Verify resource group "{0}" (available)', nonNullProp(context, 'newResourceGroupName'));
    }

    public async execute(context: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        progress.report({ message: l10n.t('Checking for resource group...') });

        const newName: string = nonNullProp(context, 'newResourceGroupName');
        const resourceClient: ResourceManagementClient = await createResourcesClient(context);

        try {
            const rgExists: boolean = (await resourceClient.resourceGroups.checkExistence(newName)).body;
            if (rgExists) {
                context.resourceGroup = await resourceClient.resourceGroups.get(newName);
                ext.outputChannel.appendLog(l10n.t('Found an existing resource group with name "{0}".', newName));
                ext.outputChannel.appendLog(l10n.t('Using resource group "{0}".', newName));
            }
        } catch (error) {
            if (!context.suppress403Handling && parseError(error).errorType === '403') {
                // Continue - we might still be able to handle missing create permissions in the create step
                this.options.continueOnFail = true;
            }
            this.error = error;
            throw error;
        }
    }

    public shouldExecute(context: T): boolean {
        return !context.resourceGroup;
    }

    private _errorItemId: string = uuidv4();
    public override createFailOutput(context: T): ExecuteActivityOutput {
        const item: ActivityChildItem = new ActivityChildItem({
            label: this.getTreeItemLabel(context),
            activityType: ActivityChildType.Fail,
            contextValue: createContextValue([this.stepName, activityFailContext]),
            iconPath: activityFailIcon,
            isParent: true,
            initialCollapsibleState: TreeItemCollapsibleState.Expanded,
        });

        if (this.options.continueOnFail) {
            item.getChildren = () => [
                new ActivityChildItem({
                    id: this._errorItemId,
                    activityType: ActivityChildType.Error,
                    contextValue: createContextValue([this.stepName, 'activity:error']), // Todo: Replace with exported constant
                    label: l10n.t('Unable to verify resource group "{0}" in subscription "{1}" due to a lack of permissions.', nonNullProp(context, 'newResourceGroupName'), context.subscriptionDisplayName),
                })
            ];
        } else if (this.error) {
            item.getChildren = () => [
                new ActivityChildItem({
                    id: this._errorItemId,
                    activityType: ActivityChildType.Error,
                    contextValue: createContextValue([this.stepName, 'activity:error']), // Todo: Replace with exported constant
                    label: parseError(this.error).message,
                })
            ];
        }

        return {
            item,
            message: this.getOutputLogFail(context),
        }
    }
}
