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

export interface Roles {
    scopeId: string | undefined;
    roleDefinitionId: string;
    roleDefinitionName: string;
}

export class RoleAssignmentExecuteStep<T extends types.IResourceGroupWizardContext> extends AzureWizardExecuteStep<T> {
    public priority: number = 900;
    private roles: () => Roles[] | undefined;
    public constructor(roles: () => Roles[] | undefined) {
        super();
        this.roles = roles;
    }

    public async execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const amClient = await createAuthorizationManagementClient(wizardContext)
        const roles = this.roles();
        if (roles) {
            for (const role of roles) {
                const scope = role.scopeId;
                if (!scope) {
                    throw new Error(l10n.t('No scope was provided for the role assignment.'));
                }
                const scopeSplitArr = scope.split('/');
                const resourceName = scopeSplitArr[scopeSplitArr.length - 1] ?? '';
                const resourceType = scopeSplitArr[scopeSplitArr.length - 2] ?? '';

                const guid = randomUUID();
                const roleDefinitionId = role.roleDefinitionId;
                const principalId = nonNullValueAndProp(wizardContext.managedIdentity, 'principalId');

                await amClient.roleAssignments.create(scope, guid, { roleDefinitionId, principalId });
                const roleAssignmentCreated = l10n.t('Role assignment "{0}" created for the {2} resource "{1}".', role.roleDefinitionName ?? '', resourceName, resourceType);
                progress.report({ message: roleAssignmentCreated });
                ext.outputChannel.appendLog(roleAssignmentCreated);
            }
        }
    }

    public shouldExecute(wizardContext: T): boolean {
        return !!wizardContext.managedIdentity;
    }
}
