/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AppServicePlan, SiteConfigResource } from '@azure/arm-appservice';
import * as fse from 'fs-extra';
import * as path from 'path';
import { l10n, ProgressLocation, window } from 'vscode';
import { ext } from '../extensionVariables';
import { ScmType } from '../ScmType';
import { ParsedSite } from '../SiteClient';
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
export async function deploy(site: ParsedSite, fsPath: string, context: IDeployContext): Promise<void> {
    const client = await site.createClient(context);
    const config: SiteConfigResource = await client.getSiteConfig();
    // We use the AppServicePlan in a few places, but we don't want to delay deployment, so start the promise now and save as a const
    const aspPromise: Promise<AppServicePlan | undefined> = client.getAppServicePlan();
    try {
        context.telemetry.properties.sourceHash = randomUtils.getPseudononymousStringHash(fsPath);
        context.telemetry.properties.destHash = randomUtils.getPseudononymousStringHash(site.fullName);
        context.telemetry.properties.scmType = String(config.scmType);
        context.telemetry.properties.isSlot = site.isSlot ? 'true' : 'false';
        context.telemetry.properties.alwaysOn = config.alwaysOn ? 'true' : 'false';
        context.telemetry.properties.linuxFxVersion = getLinuxFxVersionForTelemetry(config);
        context.telemetry.properties.nodeVersion = String(config.nodeVersion);
        context.telemetry.properties.pythonVersion = String(config.pythonVersion);
        context.telemetry.properties.hasCors = config.cors ? 'true' : 'false';
        context.telemetry.properties.hasIpSecurityRestrictions = config.ipSecurityRestrictions && config.ipSecurityRestrictions.length > 0 ? 'true' : 'false';
        context.telemetry.properties.javaVersion = String(config.javaVersion);
        context.telemetry.properties.siteKind = site.kind;
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

    const title: string = l10n.t('Deploying to "{0}"... Check [output window](command:{1}) for status.', site.fullName, ext.prefix + '.showOutputChannel');
    await window.withProgress({ location: ProgressLocation.Notification, title }, async () => {
        if (context.stopAppBeforeDeploy) {
            ext.outputChannel.appendLog(l10n.t('Stopping app...'), { resourceName: site.fullName });
            await client.stop();
        }

        ext.outputChannel.appendLog(l10n.t('Starting deployment...'), { resourceName: site.fullName });
        try {
            if (!context.deployMethod && config.scmType === ScmType.GitHub) {
                throw new Error(l10n.t('"{0}" is connected to a GitHub repository. Push to GitHub repository to deploy.', site.fullName));
            } else if (!context.deployMethod && config.scmType === ScmType.LocalGit) {
                await localGitDeploy(site, { fsPath: fsPath }, context);
            } else {
                if (!(await fse.pathExists(fsPath))) {
                    throw new Error(l10n.t('Failed to deploy path that does not exist: {0}', fsPath));
                }

                const javaRuntime = site.isLinux ? config.linuxFxVersion : config.javaContainer;
                if (javaRuntime && /^(tomcat|wildfly|jboss)/i.test(javaRuntime)) {
                    await deployWar(context, site, fsPath);
                } else if (javaRuntime && /^java/i.test(javaRuntime) && !site.isFunctionApp) {
                    const pathFileMap = new Map<string, string>([
                        [path.basename(fsPath), 'app.jar']
                    ]);
                    await deployZip(context, site, fsPath, aspPromise, pathFileMap);
                } else if (context.deployMethod === 'storage') {
                    await deployToStorageAccount(context, fsPath, site);
                } else {
                    await deployZip(context, site, fsPath, aspPromise);
                }
            }
        } finally {
            if (context.stopAppBeforeDeploy) {
                ext.outputChannel.appendLog(l10n.t('Starting app...'), { resourceName: site.fullName });
                await client.start();
            }
        }

        await startPostDeployTask(context, fsPath, config.scmType, site.fullName);

        if (context.syncTriggersPostDeploy) {
            // Don't sync triggers if app is stopped https://github.com/microsoft/vscode-azurefunctions/issues/1608
            const state: string | undefined = await client.getState();
            if (state?.toLowerCase() === 'running') {
                await syncTriggersPostDeploy(context, site);
            }
        }
    });
}

function getLinuxFxVersionForTelemetry(config: SiteConfigResource): string {
    const linuxFxVersion = config.linuxFxVersion || '';
    // Docker values point to the user's specific image, which we don't want to track
    return /^docker/i.test(linuxFxVersion) ? 'docker' : linuxFxVersion;
}
