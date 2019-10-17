/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan, SiteConfigResource } from 'azure-arm-website/lib/models';
import { ProgressLocation, window } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { ScmType } from '../ScmType';
import { SiteClient } from '../SiteClient';
import { randomUtils } from '../utils/randomUtils';
import { deployWar } from './deployWar';
import { deployZip } from './deployZip';
import { localGitDeploy } from './localGitDeploy';

/**
 * NOTE: This leverages a command with id `ext.prefix + '.showOutputChannel'` that should be registered by each extension
 */
export async function deploy(client: SiteClient, fsPath: string, context: IActionContext): Promise<void> {
    const config: SiteConfigResource = await client.getSiteConfig();
    // We use the AppServicePlan in a few places, but we don't want to delay deployment, so start the promise now and save as a const
    const aspPromise: Promise<AppServicePlan | undefined> = client.getAppServicePlan();
    try {
        context.telemetry.properties.sourceHash = randomUtils.getPseudononymousStringHash(fsPath);
        context.telemetry.properties.destHash = randomUtils.getPseudononymousStringHash(client.fullName);
        context.telemetry.properties.scmType = String(config.scmType);
        context.telemetry.properties.isSlot = client.isSlot ? 'true' : 'false';
        context.telemetry.properties.alwaysOn = config.alwaysOn ? 'true' : 'false';
        context.telemetry.properties.linuxFxVersion = String(config.linuxFxVersion);
        context.telemetry.properties.nodeVersion = String(config.nodeVersion);
        context.telemetry.properties.pythonVersion = String(config.pythonVersion);
        context.telemetry.properties.hasCors = config.cors ? 'true' : 'false';
        context.telemetry.properties.hasIpSecurityRestrictions = config.ipSecurityRestrictions && config.ipSecurityRestrictions.length > 0 ? 'true' : 'false';
        context.telemetry.properties.javaVersion = String(config.javaVersion);
        client.getState().then(
            (state: string) => {
                context.telemetry.properties.state = state;
            },
            () => {
                // ignore
            });
        aspPromise.then(
            (plan: AppServicePlan | undefined) => {
                if (plan) {
                    context.telemetry.properties.planStatus = String(plan.status);
                    context.telemetry.properties.planKind = String(plan.kind);
                    if (plan.sku) {
                        context.telemetry.properties.planSize = String(plan.sku.size);
                        context.telemetry.properties.planTier = String(plan.sku.tier);
                    }
                }
            },
            () => {
                // ignore
            });
    } catch (error) {
        // Ignore
    }

    await window.withProgress({ location: ProgressLocation.Notification, title: localize('deploying', 'Deploying to "{0}"... Check [output window](command:{1}) for status.', client.fullName, ext.prefix + '.showOutputChannel') }, async (): Promise<void> => {
        switch (config.scmType) {
            case ScmType.LocalGit:
                await localGitDeploy(client, fsPath, context);
                break;
            case ScmType.GitHub:
                throw new Error(localize('gitHubConnected', '"{0}" is connected to a GitHub repository. Push to GitHub repository to deploy.', client.fullName));
            default: //'None' or any other non-supported scmType
                if (config.linuxFxVersion && /^(tomcat|wildfly)/i.test(config.linuxFxVersion)) {
                    await deployWar(context, client, fsPath);
                    break;
                }
                await deployZip(context, client, fsPath, aspPromise);
                break;
        }
    });
}
