/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResourceGroup, ResourceManagementClient } from '@azure/arm-resources';
import { AzureWizardExecuteStepWithActivityOutput, nonNullProp, parseError } from '@microsoft/vscode-azext-utils';
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
    public async configureBeforeExecute(wizardContext: T): Promise<void> {
        const newName: string = nonNullProp(wizardContext, 'newResourceGroupName');
        const resourceClient: ResourceManagementClient = await createResourcesClient(wizardContext);

        try {
            const rgExists: boolean = (await resourceClient.resourceGroups.checkExistence(newName)).body;
            if (rgExists) {
                wizardContext.resourceGroup = await resourceClient.resourceGroups.get(newName);
                ext.outputChannel.appendLog(l10n.t('Found an existing resource group with name "{0}".', newName));
                ext.outputChannel.appendLog(l10n.t('Using resource group "{0}".', newName));
            }
        } catch (error) {
            if (wizardContext.suppress403Handling || parseError(error).errorType !== '403') {
                ext.outputChannel.appendLog(l10n.t(`Error occurred while trying to verify whether the given resource group name already exists: `));
                ext.outputChannel.appendLog(parseError(error).message);
                throw error;
            } else {
                // Don't throw yet, it could still be a concierge account
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
                // Todo: Throw a descriptive error
            }
        }
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.resourceGroup;
    }
}

class ResourceGroupNoCreatePermissionsSelectStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStepWithActivityOutput<T> {
    public priority: number = 101;
    public stepName: string = 'resourceGroupNoPermissionsSelectStep';
    protected getOutputLogSuccess = (context: T) => l10n.t('Successfully created resource group "{0}"', nonNullProp(context, 'newResourceGroupName'));
    protected getOutputLogFail = (context: T) => l10n.t('Failed to create resource group "{0}"', nonNullProp(context, 'newResourceGroupName'));
    protected getTreeItemLabel = (context: T) => l10n.t('Create resource group "{0}"', nonNullProp(context, 'newResourceGroupName'));

    public async execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number; }>): Promise<void> {
        progress.report({ message: '' });

        // if we suspect that this is a Concierge account, only pick the rg if it begins with "learn" and there is only 1
        if (/concierge/i.test(wizardContext.subscriptionDisplayName)) {
            const rgs: ResourceGroup[] = await uiUtils.listAllIterator(resourceClient.resourceGroups.list());
            if (rgs.length === 1 && rgs[0].name && /^learn/i.test(rgs[0].name)) {
                wizardContext.resourceGroup = rgs[0];
                wizardContext.telemetry.properties.forbiddenResponse = 'SelectLearnRg';
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                ext.outputChannel.appendLog(l10n.t('WARNING: Cannot create resource group "{0}" because the selected subscription is a concierge subscription. Using resource group "{1}" instead.', newName, wizardContext.resourceGroup!.name!))
                return undefined;
            }
        }

        const message: string = l10n.t('You do not have permission to create a resource group in subscription "{0}".', wizardContext.subscriptionDisplayName);
        const selectExisting: MessageItem = { title: l10n.t('Select Existing') };
        await wizardContext.ui.showWarningMessage(message, { modal: true, stepName: 'RgNoPermissions' }, selectExisting);

        wizardContext.telemetry.properties.forbiddenResponse = 'SelectExistingRg';
        const step: ResourceGroupListStep<T> = new ResourceGroupListStep(true /* suppressCreate */);
        await step.prompt(wizardContext);
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.resourceGroup;
    }
}
