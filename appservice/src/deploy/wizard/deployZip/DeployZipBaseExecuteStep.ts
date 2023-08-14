/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtPipelineResponse } from "@microsoft/vscode-azext-azureutils";
import { AzExtFsExtra } from "@microsoft/vscode-azext-utils";
import { l10n } from "vscode";
import { InnerDeployContext } from "../../IDeployContext";
import { DeployExecuteBaseStep } from "../DeployExecuteStepBase";


export abstract class DeployZipBaseExecuteStep extends DeployExecuteBaseStep {
    public constructor(readonly pathFileMap?: Map<string, string>) {
        super();
    }

    public async deployCore(context: InnerDeployContext): Promise<void> {
        const fsPath = context.workspaceFolder.uri.fsPath;
        if (!(await AzExtFsExtra.pathExists(fsPath))) {
            throw new Error(l10n.t('Failed to deploy path that does not exist: {0}', fsPath));
        }
        const response = await this.deployZip(context);
        try {
            if (response) {
                context.telemetry.properties.deploymentId = response.headers.get('scm-deployment-id');
                context.locationUrl = response.headers.get('location');
            }
        } catch (e) {
            // swallow errors, we don't want a failure here to block deployment
        }
    }

    protected abstract deployZip(context: InnerDeployContext): Promise<AzExtPipelineResponse | void>;
}
