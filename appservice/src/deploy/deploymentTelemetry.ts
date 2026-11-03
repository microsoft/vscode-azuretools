/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AzExtPipelineResponse } from '@microsoft/vscode-azext-azureutils';
import { DeploymentMechanism, IActionContext, initializeWorkflowTelemetry, setWorkflowTelemetryDetails, withTelemetryStage, WorkflowTelemetryDetails } from '@microsoft/vscode-azext-utils';

export function initializeDeploymentTelemetry(context: IActionContext): void {
    initializeWorkflowTelemetry(context, {
        workflow: 'deploy', command: 'deploy',
        stepNames: [
            'deploy.zip', 'deploy.war', 'deploy.flex', 'deploy.storage', 'deploy.localGit', 'deploy.github',
            'deploy.wait', 'deploy.syncTriggers', 'deploy.postTask', 'deploy.stopApp', 'deploy.startApp', 'deploy.delay',
            'pushWithUncommitChanges', 'forcePush'
        ]
    });
}

export async function trackDeploymentUpload<T extends AzExtPipelineResponse>(context: IActionContext, mechanism: DeploymentMechanism, callback: () => Promise<T>): Promise<T> {
    setWorkflowTelemetryDetails(context, { deploymentMechanism: mechanism });
    const response = await withTelemetryStage(context, { stage: 'upload' }, async () => {
        const result = await callback();
        setWorkflowTelemetryDetails(context, { httpStatus: result.status, deploymentMechanism: mechanism });
        return result;
    });
    await withTelemetryStage(context, { stage: 'acceptance' }, async stage => {
        const accepted = response.status >= 200 && response.status < 300;
        const rejected = response.status >= 400 && response.status < 600;
        setWorkflowTelemetryDetails(context, { deploymentStatus: accepted ? 'accepted' : 'unknown', httpStatus: response.status });
        stage.setOutcome(accepted ? 'succeeded' : rejected ? 'failed' : 'unknown', {
            httpStatus: response.status, deploymentMechanism: mechanism,
            deploymentStatus: accepted ? 'accepted' : 'unknown'
        });
        await Promise.resolve();
    });
    return response;
}

/** Kudu status is not a boolean: unknown, partial and superseded are not completed success. */
export function getDeploymentStatusDetails(status: number | undefined, isTemp?: boolean): WorkflowTelemetryDetails {
    if (status === 0 || status === 2) {
        return { deploymentStatus: 'running' };
    } else if (status === 3 || isTemp) {
        return { deploymentStatus: 'failed', failureCategory: 'deployment', failureCode: 'deploymentFailed' };
    } else if (status === 4) {
        return { deploymentStatus: 'succeeded' };
    } else if (status === 5 || status === -1) {
        return { deploymentStatus: 'canceled', failureCategory: 'deployment', failureCode: status === 5 ? 'deploymentSuperseded' : 'deploymentCanceled', cancelReason: 'unknown' };
    } else if (status === 6) {
        return { deploymentStatus: 'partial', failureCategory: 'deployment', failureCode: 'deploymentPartial' };
    }
    return { deploymentStatus: 'unknown', failureCategory: 'deployment', failureCode: 'deploymentStatusUnavailable' };
}
