/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource } from "@azure/arm-appservice";
import { AzureWizardExecuteStep } from "@microsoft/vscode-azext-utils";
import { ScmType } from "../../ScmType";
import { InnerDeployContext } from "../IDeployContext";
import { DeployGitHubExecuteStep } from "./DeployGitHubExecuteStep";
import { DeployLocalGitExecuteStep } from "./DeployLocalGitExecuteStep";
import { PostDeploySyncTriggersExecuteStep } from "./PostDeploySyncTriggersExecuteStep";
import { PostDeployTaskExecuteStep } from "./PostDeployTaskExecuteStep";
import { StartAppAfterDeployExecuteStep } from "./StartAppAfterDeployExecuteStep";
import { StopAppBeforeDeployExecuteStep } from "./StopAppBeforeDeployExecuteStep";
import { DelayFirstWebAppDeployStep } from "./deployZip/DelayFirstWebAppDeployStep";
import { DeployStorageAccountExecuteStep } from "./deployZip/DeployStorageAccountExecuteStep";
import { DeployWarExecuteStep } from "./deployZip/DeployWarExecuteStep";
import { DeployZipPushExecuteStep } from "./deployZip/DeployZipPushExecuteStep";
import { WaitForDeploymentToCompleteStep } from "./deployZip/WaitForDeploymentToCompleteStep";
import path = require("path");

export async function createDeployExecuteSteps(context: InnerDeployContext): Promise<AzureWizardExecuteStep<InnerDeployContext>[]> {
    const executeSteps: AzureWizardExecuteStep<InnerDeployContext>[] = [];
    const config: SiteConfigResource = await context.client.getSiteConfig();

    if (context.stopAppBeforeDeploy) {
        executeSteps.push(new StopAppBeforeDeployExecuteStep(), new StartAppAfterDeployExecuteStep());
    }

    if (!context.deployMethod && config.scmType === ScmType.GitHub) {
        executeSteps.push(new DeployGitHubExecuteStep());
    } else {
        // deployments that are handled by kudu
        if (!context.deployMethod && config.scmType === ScmType.LocalGit) {
            executeSteps.push(new DeployLocalGitExecuteStep());
        } else {
            // all zip-based deployments
            const javaRuntime = context.site.isLinux ? config.linuxFxVersion : config.javaContainer;
            if (javaRuntime && /^(tomcat|wildfly|jboss)/i.test(javaRuntime)) {
                executeSteps.push(new DeployWarExecuteStep());
            } else if (javaRuntime && /^java/i.test(javaRuntime) && !context.site.isFunctionApp) {
                const pathFileMap = new Map<string, string>([
                    [path.basename(context.workspaceFolder.uri.fsPath), 'app.jar']
                ]);
                executeSteps.push(new DeployZipPushExecuteStep(pathFileMap));
            } else if (context.deployMethod === 'storage') {
                executeSteps.push(new DeployStorageAccountExecuteStep());
            } else {
                executeSteps.push(new DeployZipPushExecuteStep());
            }
            executeSteps.push(new DelayFirstWebAppDeployStep());
        }

        executeSteps.push(new WaitForDeploymentToCompleteStep());
    }

    executeSteps.push(new PostDeployTaskExecuteStep(config))
    if (context.syncTriggersPostDeploy) {
        executeSteps.push(new PostDeploySyncTriggersExecuteStep());
    }

    return executeSteps;
}
