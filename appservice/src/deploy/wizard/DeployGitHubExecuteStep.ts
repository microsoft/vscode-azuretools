/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { l10n } from "vscode";
import { InnerDeployContext } from "../IDeployContext";
import { DeployExecuteStepBase } from "./DeployExecuteStepBase";
import { setWorkflowOutcome, setWorkflowTelemetryDetails } from '@microsoft/vscode-azext-utils';

export class DeployGitHubExecuteStep extends DeployExecuteStepBase {
    public telemetryId = 'deploy.github';
    // eslint-disable-next-line @typescript-eslint/require-await
    public async deployCore(context: InnerDeployContext): Promise<void> {
        setWorkflowTelemetryDetails(context, { deploymentMechanism: 'github', deploymentStatus: 'unknown' });
        setWorkflowOutcome(context, 'blocked', { failureCategory: 'prerequisite', failureCode: 'githubDeploymentRequired' });
        throw new Error(l10n.t('"{0}" is connected to a GitHub repository. Push to GitHub repository to deploy.', context.site.fullName));
    }
}
