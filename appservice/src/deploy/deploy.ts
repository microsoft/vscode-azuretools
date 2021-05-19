/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import * as fse from 'fs-extra';
import * as path from 'path';
import { ProgressLocation, window } from 'vscode';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { ScmType } from '../ScmType';
import { SiteClient } from '../SiteClient';
import { randomUtils } from '../utils/randomUtils';
import { deployToStorageAccount } from './deployToStorageAccount';
import { deployWar } from './deployWar';
import { deployZip } from './deployZip';
import { IDeployContext } from './IDeployContext';
import { localGitDeploy } from './localGitDeploy';
import { startPostDeployTask } from './runDeployTask';
import { syncTriggersPostDeploy } from './syncTriggersPostDeploy';

/**
 * NOTE: This leverages a command with id `ext.prefix + '.showOutputChannel'` that should be registered by each extension
 */
export async function deploy(client: SiteClient, fsPath: string, context: IDeployContext): Promise<void> {
    const config: WebSiteManagementModels.SiteConfigResource = await client.getSiteConfig();
    // We use the AppServicePlan in a few places, but we don't want to delay deployment, so start the promise now and save as a const
    const aspPromise: Promise<WebSiteManagementModels.AppServicePlan | undefined> = client.getAppServicePlan();
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
            (plan: WebSiteManagementModels.AppServicePlan | undefined) => {
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

    const title: string = localize('deploying', 'Deploying to "{0}"... Check [output window](command:{1}) for status.', client.fullName, ext.prefix + '.showOutputChannel');
    await window.withProgress({ location: ProgressLocation.Notification, title }, async () => {
        if (context.stopAppBeforeDeploy) {
            ext.outputChannel.appendLog(localize('stoppingApp', 'Stopping app...'), { resourceName: client.fullName });
            await client.stop();
        }

        ext.outputChannel.appendLog(localize('deployStart', 'Starting deployment...'), { resourceName: client.fullName });
        try {
            if (!context.deployMethod && config.scmType === ScmType.GitHub) {
                throw new Error(localize('gitHubConnected', '"{0}" is connected to a GitHub repository. Push to GitHub repository to deploy.', client.fullName));
            } else if (!context.deployMethod && config.scmType === ScmType.LocalGit) {
                await localGitDeploy(client, { fsPath: fsPath }, context);
            } else {
                if (!(await fse.pathExists(fsPath))) {
                    throw new Error(localize('pathNotExist', 'Failed to deploy path that does not exist: {0}', fsPath));
                }
                const javaRuntime = client.isLinux ? config.linuxFxVersion : config.javaContainer;
                if (javaRuntime && /^(tomcat|wildfly|jboss)/i.test(javaRuntime)) {
                    await deployWar(context, client, fsPath);
                } else if (javaRuntime && /^java/i.test(javaRuntime)) {
                    // For Java SE runtime, need rename the artifact to app.jar
                    let javaArtifact: string = fsPath;
                    if (path.basename(javaArtifact) !== "app.jar") {
                        javaArtifact = path.join(await fse.mkdtemp("app-service"), "app.jar");
                        await fse.copyFile(fsPath, javaArtifact);
                    }
                    await deployZip(context, client, javaArtifact, aspPromise);
                } else if (context.deployMethod === 'storage') {
                    await deployToStorageAccount(context, fsPath, client);
                } else {
                    await deployZip(context, client, fsPath, aspPromise);
                }
            }
        } finally {
            if (context.stopAppBeforeDeploy) {
                ext.outputChannel.appendLog(localize('startingApp', 'Starting app...'), { resourceName: client.fullName });
                await client.start();
            }
        }

        await startPostDeployTask(context, fsPath, config.scmType, client.fullName);

        if (context.syncTriggersPostDeploy) {
            // Don't sync triggers if app is stopped https://github.com/microsoft/vscode-azurefunctions/issues/1608
            const state: string | undefined = await client.getState();
            if (state?.toLowerCase() === 'running') {
                await syncTriggersPostDeploy(client);
            }
        }
    });
}
