/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from '@azure/arm-resources';
import { AzureWizardExecuteStepWithActivityOutput, nonNullProp, parseError } from '@microsoft/vscode-azext-utils';
import { l10n, Progress } from 'vscode';
import * as types from '../../index';
import { createResourcesClient } from '../clients';
import { ext } from '../extensionVariables';

export class ResourceGroupVerifyStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStepWithActivityOutput<T> {
    public priority: number = 95;
    public stepName: string = 'resourceGroupVerifyStep';

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
            throw error;
        }
    }

    public shouldExecute(context: T): boolean {
        return !context.resourceGroup;
    }
}
