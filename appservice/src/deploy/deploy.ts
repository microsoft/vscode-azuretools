/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan, SiteConfigResource } from 'azure-arm-website/lib/models';
import { ProgressLocation, window } from 'vscode';
import { IActionContext, TelemetryProperties } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { ScmType } from '../ScmType';
import { SiteClient } from '../SiteClient';
import { javaUtils } from '../utils/javaUtils';
import { randomUtils } from '../utils/randomUtils';
import { deployWar } from './deployWar';
import { deployZip } from './deployZip';
import { localGitDeploy } from './localGitDeploy';

export async function deploy(client: SiteClient, fsPath: string, actionContext: IActionContext): Promise<void> {
    const telemetryProperties: TelemetryProperties = actionContext.properties;
    const config: SiteConfigResource = await client.getSiteConfig();
    // We use the AppServicePlan in a few places, but we don't want to delay deployment, so start the promise now and save as a const
    const aspPromise: Promise<AppServicePlan | undefined> = client.getAppServicePlan();
    try {
        telemetryProperties.sourceHash = randomUtils.getPseudononymousStringHash(fsPath);
        telemetryProperties.destHash = randomUtils.getPseudononymousStringHash(client.fullName);
        telemetryProperties.scmType = String(config.scmType);
        telemetryProperties.isSlot = client.isSlot ? 'true' : 'false';
        telemetryProperties.alwaysOn = config.alwaysOn ? 'true' : 'false';
        telemetryProperties.linuxFxVersion = String(config.linuxFxVersion);
        telemetryProperties.nodeVersion = String(config.nodeVersion);
        telemetryProperties.pythonVersion = String(config.pythonVersion);
        telemetryProperties.hasCors = config.cors ? 'true' : 'false';
        telemetryProperties.hasIpSecurityRestrictions = config.ipSecurityRestrictions && config.ipSecurityRestrictions.length > 0 ? 'true' : 'false';
        telemetryProperties.javaVersion = String(config.javaVersion);
        client.getState().then(
            (state: string) => {
                telemetryProperties.state = state;
            },
            () => {
                // ignore
            });
        aspPromise.then(
            (plan: AppServicePlan | undefined) => {
                if (plan) {
                    telemetryProperties.planStatus = String(plan.status);
                    telemetryProperties.planKind = String(plan.kind);
                    if (plan.sku) {
                        telemetryProperties.planSize = String(plan.sku.size);
                    }
                }
            },
            () => {
                // ignore
            });
    } catch (error) {
        // Ignore
    }

    if (javaUtils.isJavaSERuntime(config.linuxFxVersion)) {
        await javaUtils.configureJavaSEAppSettings(client);
    }

    await window.withProgress({ location: ProgressLocation.Notification, title: localize('deploying', 'Deploying to "{0}"... Check output window for status.', client.fullName) }, async (): Promise<void> => {
        switch (config.scmType) {
            case ScmType.LocalGit:
                await localGitDeploy(client, fsPath);
                break;
            case ScmType.GitHub:
                throw new Error(localize('gitHubConnected', '"{0}" is connected to a GitHub repository. Push to GitHub repository to deploy.', client.fullName));
            default: //'None' or any other non-supported scmType
                if (javaUtils.isJavaWebContainerRuntime(config.linuxFxVersion)) {
                    await deployWar(client, fsPath);
                    break;
                }
                await deployZip(client, fsPath, aspPromise);
                break;
        }
    });
}
