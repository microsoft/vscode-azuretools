/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RequestBodyType } from "@azure/core-rest-pipeline";
import { AzExtPipelineResponse } from "@microsoft/vscode-azext-azureutils";
import { publisherName } from "../../../constants";
import { InnerDeployContext } from "../../IDeployContext";
import { runWithZipStream } from "../../runWithZipStream";
import { DeployZipBaseExecuteStep } from "./DeployZipBaseExecuteStep";

export class DeployZipPushExecuteStep extends DeployZipBaseExecuteStep {
    public async deployZip(context: InnerDeployContext): Promise<AzExtPipelineResponse | void> {
        const kuduClient = await context.site.createClient(context);
        const callback = async zipStream => {
            return await kuduClient.zipPushDeploy(context, () => zipStream as RequestBodyType, {
                author: publisherName,
                deployer: publisherName,
                isAsync: true,
                trackDeploymentId: true
            });
        };

        return await runWithZipStream(context, {
            fsPath: context.workspaceFolder.uri.fsPath,
            site: context.site,
            pathFileMap: this.pathFileMap,
            callback,
            progress: this.progress
        });
    }
}
