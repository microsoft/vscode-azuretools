/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, nonNullValueAndProp } from '@microsoft/vscode-azext-utils';
import { randomUUID } from 'crypto';
import { l10n, Progress } from 'vscode';
import * as types from '../../index';
import { createAuthorizationManagementClient } from '../clients';
import { ext } from '../extensionVariables';

export enum RoleDefinitionId {
    StorageBlobDataContributor = '/providers/Microsoft.Authorization/roleDefinitions/ba92f5b4-2d11-453d-a403-e96b0029c9fe'
}

export class RoleAssignmentExecuteStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStep<T> {
    public priority: number = 900;
    private getScopeId: () => string | undefined;
    private _roleDefinitionId: types.RoleDefinitionId;
    public constructor(getScopeId: () => string | undefined, roleDefinitionId: types.RoleDefinitionId) {
        super();
        this.getScopeId = getScopeId;
        this._roleDefinitionId = roleDefinitionId;
    }

    public async execute(wizardContext: T, _progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const amClient = await createAuthorizationManagementClient(wizardContext)
        const scope = this.getScopeId();
        if (!scope) {
            throw new Error(l10n.t('No scope was provided for the role assignment.'));
        }

        const guid = randomUUID();
        const roleDefinitionDisplayName = Object.keys(RoleDefinitionId)[Object.values(RoleDefinitionId).indexOf(this._roleDefinitionId)];
        const roleDefinitionId = this._roleDefinitionId as unknown as string;
        const principalId = nonNullValueAndProp(wizardContext.managedIdentity, 'principalId');
        await amClient.roleAssignments.create(scope, guid, { roleDefinitionId, principalId });
        const roleAssignmentCreated = l10n.t('Role assignment "{1}" created with resource "{0}".', scope, roleDefinitionDisplayName);
        ext.outputChannel.appendLog(roleAssignmentCreated);
    }

    public shouldExecute(wizardContext: T): boolean {
        return !!wizardContext.managedIdentity;
    }
}
