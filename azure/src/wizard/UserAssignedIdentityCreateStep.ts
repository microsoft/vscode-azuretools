/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type ManagedServiceIdentityClient } from '@azure/arm-msi';
import { AzureWizardExecuteStepWithActivityOutput, nonNullProp, nonNullValueAndProp } from '@microsoft/vscode-azext-utils';
import { l10n, Progress } from 'vscode';
import * as types from '../../index';
import { createManagedServiceIdentityClient } from '../clients';
import { storageProvider } from '../constants';
import { LocationListStep } from './LocationListStep';
import { UserAssignedIdentityNameStep } from './UserAssignedIdentityNameStep';

/**
 * Naming constraints:
 * The resource name must start with a letter or number,
 * have a length between 3 and 128 characters and
 * can only contain a combination of alphanumeric characters, hyphens and underscores
 * But since we are appending "-identities" to the resource group name and that has the same constraints and a 90 character limit,
 * we don't need to do any verification
 **/
export class UserAssignedIdentityCreateStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStepWithActivityOutput<T> {
    // We should create this immediately after the resource group is created
    public priority: number = 101;
    public stepName: string = 'UserAssignedIdentityCreateStep';

    public async execute(wizardContext: T, _progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const newLocation: string = (await LocationListStep.getLocation(wizardContext, storageProvider)).name;
        const rgName: string = wizardContext.newResourceGroupName ?? nonNullValueAndProp(wizardContext.resourceGroup, 'name');
        const miName: string = nonNullProp(wizardContext, 'newManagedIdentityName');

        const msiClient: ManagedServiceIdentityClient = await createManagedServiceIdentityClient(wizardContext);
        wizardContext.managedIdentity = await msiClient.userAssignedIdentities.createOrUpdate(
            rgName,
            miName,
            {
                location: newLocation
            }
        );
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.managedIdentity;
    }

    public async configureBeforeExecute(wizardContext: T): Promise<void> {
        const rgName: string = wizardContext.newResourceGroupName ?? nonNullValueAndProp(wizardContext.resourceGroup, 'name');
        while (!wizardContext.newManagedIdentityName) {
            wizardContext.newManagedIdentityName = await UserAssignedIdentityNameStep.tryGenerateRelatedName(wizardContext, rgName);
        }
    }

    protected getTreeItemLabel(context: T): string {
        const newName: string = nonNullProp(context, 'newManagedIdentityName');
        return l10n.t('Create user-assigned identity "{0}"', newName);
    }
    protected getOutputLogSuccess(context: T): string {
        const newName: string = nonNullProp(context, 'newManagedIdentityName');
        return l10n.t('Successfully created user-assigned identity "{0}".', newName);
    }
    protected getOutputLogFail(context: T): string {
        const newName: string = nonNullProp(context, 'newManagedIdentityName');
        return l10n.t('Failed to create user-assigned identity "{0}".', newName);
    }
    protected getOutputLogProgress(context: T): string {
        const newName: string = nonNullProp(context, 'newManagedIdentityName');
        return l10n.t('Creating user-assigned identity "{0}"...', newName);
    }
}
