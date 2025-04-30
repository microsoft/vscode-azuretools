/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, AzureWizardExecuteStepWithActivityOutput, ExecuteActivityContext, nonNullValueAndProp, parseError } from '@microsoft/vscode-azext-utils';
import { randomUUID } from 'crypto';
import { l10n, Progress } from 'vscode';
import * as types from '../../index';
import { createAuthorizationManagementClient } from '../clients';

export interface Role {
    scopeId: string | undefined;
    roleDefinitionId: string;
    roleDefinitionName: string;
}

export class RoleAssignmentExecuteStep extends AzureWizardExecuteStep<types.IResourceGroupWizardContext & Partial<ExecuteActivityContext>> {
    public async execute(_wiardContext: types.IResourceGroupWizardContext & Partial<ExecuteActivityContext>, _progress: Progress<{ message?: string; increment?: number; }>): Promise<void> {
        // nothing should execute, but we need shouldExecute to be true so that addExecuteSteps is called
        return undefined;
    }
    public shouldExecute(_wizardContext: types.IResourceGroupWizardContext & Partial<ExecuteActivityContext>): boolean {
        return true;
    }

    private roles: () => Role[] | undefined;
    public constructor(roles: () => Role[] | undefined) {
        super();
        this.roles = roles;
    }
    public priority: number = 900;
    public addExecuteSteps(_context: types.IResourceGroupWizardContext & Partial<ExecuteActivityContext>): AzureWizardExecuteStep<types.IResourceGroupWizardContext & Partial<ExecuteActivityContext>>[] {
        const roles = this.roles();
        const steps = [];
        for (const role of roles ?? []) {
            steps.push(new SingleRoleAssignmentExecuteStep(role));
        }

        return steps;
    }
}

class SingleRoleAssignmentExecuteStep<T extends types.IResourceGroupWizardContext & Partial<ExecuteActivityContext>> extends AzureWizardExecuteStepWithActivityOutput<T> {
    stepName: string = 'RoleAssignmentExecuteStep';
    protected getTreeItemLabel(_context: T): string {
        const { resourceName, resourceType } = this.resourceNameAndType;
        return l10n.t('Create role assignment "{0}" for the {1} resource "{2}"', this.role.roleDefinitionName, resourceType, resourceName);
    }
    protected getOutputLogSuccess(_context: T): string {
        const { resourceName, resourceType } = this.resourceNameAndType;
        return l10n.t('Successfully created role assignment "{0}" for the {1} resource "{2}".', this.role.roleDefinitionName, resourceType, resourceName);
    }
    protected getOutputLogFail(_context: T): string {
        const { resourceName, resourceType } = this.resourceNameAndType;
        return l10n.t('Failed to create role assignment "{0}" for the {1} resource "{2}".', this.role.roleDefinitionName, resourceType, resourceName);
        throw new Error('Method not implemented.');
    }
    protected getOutputLogProgress(_context: T): string {
        const { resourceName, resourceType } = this.resourceNameAndType;
        return l10n.t('Creating role assignment "{0}" for the {1} resource "{2}"...', this.role.roleDefinitionName, resourceType, resourceName);
    }
    public priority: number = 901;
    private _retries: number = 0;
    public constructor(readonly role: Role) {
        super();
    }

    public async executeCore(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const amClient = await createAuthorizationManagementClient(wizardContext)
        const scope = this.role.scopeId;
        if (!scope) {
            throw new Error(l10n.t('No scope was provided for the role assignment.'));
        }

        try {
            const guid = randomUUID();
            const roleDefinitionId = this.role.roleDefinitionId;
            const principalId = nonNullValueAndProp(wizardContext.managedIdentity, 'principalId');

            await amClient.roleAssignments.create(scope, guid, { roleDefinitionId, principalId });
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

            throw parsedError;
        }
    }

    public async execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        return await this.executeCore(wizardContext, progress);
    }

    public shouldExecute(wizardContext: T): boolean {
        return !!wizardContext.managedIdentity;
    }

    private get resourceNameAndType(): { resourceName: string; resourceType: string } {
        const scope = this.role.scopeId;
        if (!scope) {
            throw new Error(l10n.t('No scope was provided for the role assignment.'));
        }
        const scopeSplitArr = scope.split('/');
        const resourceName = scopeSplitArr[scopeSplitArr.length - 1] ?? '';
        const resourceType = scopeSplitArr[scopeSplitArr.length - 2] ?? '';
        return { resourceName, resourceType };
    }
}
