/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResourceGroup, ResourceManagementClient } from '@azure/arm-resources';
import { AzureWizardExecuteStepWithActivityOutput, nonNullProp, nonNullValueAndProp, parseError } from '@microsoft/vscode-azext-utils';
import { l10n, MessageItem, Progress } from 'vscode';
import * as types from '../../index';
import { createResourcesClient } from '../clients';
import { resourcesProvider } from '../constants';
import { ext } from '../extensionVariables';
import { uiUtils } from '../utils/uiUtils';
import { LocationListStep } from './LocationListStep';
import { ResourceGroupListStep } from './ResourceGroupListStep';

export class ResourceGroupCreateStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStepWithActivityOutput<T> {
    public priority: number = 100;
    public stepName: string = 'resourceGroupCreateStep';
    protected getOutputLogSuccess = (context: T) => l10n.t('Successfully created resource group "{0}"', nonNullProp(context, 'newResourceGroupName'));
    protected getOutputLogFail = (context: T) => l10n.t('Failed to create resource group "{0}"', nonNullProp(context, 'newResourceGroupName'));
    protected getTreeItemLabel = (context: T) => l10n.t('Create resource group "{0}"', nonNullProp(context, 'newResourceGroupName'));

    // Verify if a resource group with the same new name already exists
    public async configureBeforeExecute(context: T): Promise<void> {
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
            if (context.suppress403Handling || parseError(error).errorType !== '403') {
                ext.outputChannel.appendLog(l10n.t(`Error occurred while trying to verify whether the given resource group name already exists: `));
                ext.outputChannel.appendLog(parseError(error).message);
                throw error;
            } else {
                // Don't throw yet, we might still be able to handle this condition in the following methods
            }
        }
    }

    public async execute(wizardContext: T, _progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const newName: string = nonNullProp(wizardContext, 'newResourceGroupName');
        const newLocationName: string = (await LocationListStep.getLocation(wizardContext, resourcesProvider, false)).name;
        const resourceClient: ResourceManagementClient = await createResourcesClient(wizardContext);

        try {
            wizardContext.resourceGroup = await resourceClient.resourceGroups.createOrUpdate(newName, { location: newLocationName });
        } catch (error) {
            if (wizardContext.suppress403Handling || parseError(error).errorType !== '403') {
                throw error;
            } else {
                this.options.continueOnFail = true;
                this.addExecuteSteps = () => [new ResourceGroupNoCreatePermissionsSelectStep()];

                const message: string = l10n.t('Unable to create resource group "{0}" in subscription "{1}" due to a lack of permissions.', newName, wizardContext.subscriptionDisplayName);
                ext.outputChannel.appendLog(message);
                ext.outputChannel.appendLog(parseError(error).message);
                throw new Error(message);
            }
        }
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.resourceGroup;
    }
}

class ResourceGroupNoCreatePermissionsSelectStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStepWithActivityOutput<T> {
    public priority: number = 101;
    public stepName: string = 'resourceGroupNoCreatePermissionsSelectStep';
    protected getOutputLogSuccess = (context: T) => l10n.t('Successfully selected existing resource group "{0}"', nonNullValueAndProp(context.resourceGroup, 'name'));
    protected getOutputLogFail = () => l10n.t('Failed to select an existing resource group.');
    protected getTreeItemLabel = (context: T) => {
        return context.resourceGroup?.name ?
            l10n.t('Select resource group "{0}"', context.resourceGroup.name) :
            l10n.t('Select resource group');
    }

    public async execute(context: T, progress: Progress<{ message?: string; increment?: number; }>): Promise<void> {
        progress.report({ message: l10n.t('Selecting resource group...') });

        const newName: string = nonNullProp(context, 'newResourceGroupName');
        const resourceClient: ResourceManagementClient = await createResourcesClient(context);

        // if we suspect that this is a Concierge account, only pick the rg if it begins with "learn" and there is only 1
        if (/concierge/i.test(context.subscriptionDisplayName)) {
            const rgs: ResourceGroup[] = await uiUtils.listAllIterator(resourceClient.resourceGroups.list());
            if (rgs.length === 1 && rgs[0].name && /^learn/i.test(rgs[0].name)) {
                context.resourceGroup = rgs[0];
                context.telemetry.properties.forbiddenResponse = 'SelectLearnRg';
                ext.outputChannel.appendLog(l10n.t('WARNING: Cannot create resource group "{0}" because the selected subscription is a concierge subscription. Using resource group "{1}" instead.', newName, nonNullValueAndProp(context.resourceGroup, 'name')));
                return;
            }
        }

        const message: string = l10n.t('You do not have permission to create a resource group in subscription "{0}".', context.subscriptionDisplayName);
        const selectExisting: MessageItem = { title: l10n.t('Select Existing') };
        await context.ui.showWarningMessage(message, { modal: true, stepName: 'RgNoPermissions' }, selectExisting);

        context.telemetry.properties.forbiddenResponse = 'SelectExistingRg';
        const step: ResourceGroupListStep<T> = new ResourceGroupListStep(true /* suppressCreate */);
        await step.prompt(context);
    }

    public shouldExecute(context: T): boolean {
        return !context.resourceGroup;
    }
}
