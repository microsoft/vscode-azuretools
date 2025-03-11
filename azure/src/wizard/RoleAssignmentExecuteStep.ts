/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { activityFailIcon, activitySuccessContext, activitySuccessIcon, AzureWizardExecuteStep, createUniversallyUniqueContextValue, ExecuteActivityContext, GenericTreeItem, nonNullValueAndProp, parseError } from '@microsoft/vscode-azext-utils';
import { randomUUID } from 'crypto';
import { l10n, Progress } from 'vscode';
import * as types from '../../index';
import { createAuthorizationManagementClient } from '../clients';
import { ext } from '../extensionVariables';

export interface Role {
    scopeId: string | undefined;
    roleDefinitionId: string;
    roleDefinitionName: string;
}

export class RoleAssignmentExecuteStep<T extends types.IResourceGroupWizardContext & Partial<ExecuteActivityContext>> extends AzureWizardExecuteStep<T> {
    public priority: number = 900;
    private roles: () => Role[] | undefined;
    public constructor(roles: () => Role[] | undefined) {
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
                try {
                    const guid = randomUUID();
                    const roleDefinitionId = role.roleDefinitionId;
                    const principalId = nonNullValueAndProp(wizardContext.managedIdentity, 'principalId');

                    await amClient.roleAssignments.create(scope, guid, { roleDefinitionId, principalId });
                    const roleAssignmentCreated = l10n.t('Role assignment "{0}" created for the {2} resource "{1}".', role.roleDefinitionName ?? '', resourceName, resourceType);
                    progress.report({ message: roleAssignmentCreated });
                    ext.outputChannel.appendLog(roleAssignmentCreated);
                    if (wizardContext.activityChildren) {
                        wizardContext.activityChildren.push(
                            new GenericTreeItem(undefined, {
                                contextValue: createUniversallyUniqueContextValue(['successfullRoleAssignment', activitySuccessContext]),
                                label: l10n.t(`Role Assignment ${role.roleDefinitionName} created for ${resourceName}`),
                                iconPath: activitySuccessIcon
                            })
                        );
                    }
                } catch (error) {
                    const roleAssignmentFailed = l10n.t('Failed to create role assignment "{0}" for the {2} resource "{1}".', role.roleDefinitionName ?? '', resourceName, resourceType);
                    progress.report({ message: roleAssignmentFailed });
                    ext.outputChannel.appendLog(roleAssignmentFailed);
                    const parsedError = parseError(error);
                    ext.outputChannel.appendLog(parsedError.message);
                    if (wizardContext.activityChildren) {
                        wizardContext.activityChildren.push(new GenericTreeItem(undefined, {
                            contextValue: createUniversallyUniqueContextValue(['failedRoleAssignment', activitySuccessContext]),
                            label: l10n.t(`Role Assignment ${role.roleDefinitionName} failed for ${resourceName}`),
                            iconPath: activityFailIcon
                        }));
                    }
                }

            }

            if (wizardContext.activityChildren) {
                for (const child of wizardContext.activityChildren) {
                    if (child.contextValue.includes('failedRoleAssignment')) {
                        throw new Error(l10n.t('Failed to create role assignment(s).'));
                    }
                }
            }
        }
    }

    public shouldExecute(wizardContext: T): boolean {
        return !!wizardContext.managedIdentity;
    }
}
