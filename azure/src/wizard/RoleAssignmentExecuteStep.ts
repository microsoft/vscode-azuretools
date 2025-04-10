/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ActivityChildItem, ActivityChildType, activityFailContext, activityFailIcon, activitySuccessContext, activitySuccessIcon, AzureWizardExecuteStep, createContextValue, ExecuteActivityContext, nonNullValueAndProp, parseError } from '@microsoft/vscode-azext-utils';
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
    private _retries: number = 0;
    private roles: () => Role[] | undefined;
    public constructor(roles: () => Role[] | undefined) {
        super();
        this.roles = roles;
    }

    public async executeCore(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
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
                            new ActivityChildItem({
                                activityType: ActivityChildType.Success,
                                contextValue: createContextValue(['successfulRoleAssignment', activitySuccessContext]),
                                label: l10n.t('Role Assignment {0} created for {1}', role.roleDefinitionName, resourceName),
                                iconPath: activitySuccessIcon
                            })
                        );
                    }
                } catch (error) {
                    const parsedError = parseError(error);
                    const maxRetries = 5;
                    // if this error is due to a replication delay, we can retry the operation and it should resolve it
                    if (parsedError.message.includes('If you are creating this principal and then immediately assigning a role, this error might be related to a replication delay.')
                        && this._retries < maxRetries) {
                        this._retries++;
                        wizardContext.telemetry.properties.roleAssignmentCreateRetryCount = this._retries.toString();
                        return await this.executeCore(wizardContext, progress);
                    }

                    const roleAssignmentFailed = l10n.t('Failed to create role assignment "{0}" for the {2} resource "{1}".', role.roleDefinitionName ?? '', resourceName, resourceType);
                    progress.report({ message: roleAssignmentFailed });
                    ext.outputChannel.appendLog(roleAssignmentFailed);
                    ext.outputChannel.appendLog(parsedError.message);
                    if (wizardContext.activityChildren) {
                        wizardContext.activityChildren.push(new ActivityChildItem({
                            activityType: ActivityChildType.Fail,
                            contextValue: createContextValue(['failedRoleAssignment', activityFailContext]),
                            label: l10n.t('Role Assignment {0} failed for {1}', role.roleDefinitionName, resourceName),
                            iconPath: activityFailIcon
                        }));
                    }
                }

            }

            if (wizardContext.activityChildren) {
                for (const child of wizardContext.activityChildren) {
                    if (child.contextValue?.includes('failedRoleAssignment')) {
                        throw new Error(l10n.t('Failed to create role assignment(s).'));
                    }
                }
            }
        }
    }

    public async execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        return await this.executeCore(wizardContext, progress);
    }

    public shouldExecute(wizardContext: T): boolean {
        return !!wizardContext.managedIdentity;
    }
}
