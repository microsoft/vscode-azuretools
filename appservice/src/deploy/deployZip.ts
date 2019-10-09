/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan, StringDictionary } from 'azure-arm-website/lib/models';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { KuduClient } from 'vscode-azurekudu';
import { ext } from '../extensionVariables';
import * as FileUtilities from '../FileUtilities';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { deployToStorageAccount } from './deployToStorageAccount';
import { syncTriggersPostDeploy } from './syncTriggersPostDeploy';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function deployZip(context: IActionContext, client: SiteClient, fsPath: string, aspPromise: Promise<AppServicePlan | undefined>): Promise<void> {
    if (!(await fse.pathExists(fsPath))) {
        throw new Error(localize('pathNotExist', 'Failed to deploy path that does not exist: {0}', fsPath));
    }

    let zipFilePath: string;
    let createdZip: boolean = false;
    if (FileUtilities.getFileExtension(fsPath) === 'zip') {
        context.telemetry.properties.alreadyZipped = 'true';
        zipFilePath = fsPath;
    } else {
        createdZip = true;
        ext.outputChannel.appendLog(localize('zipCreate', 'Creating zip package...'), { resourceName: client.fullName });
        zipFilePath = await getZipFileToDeploy(fsPath, client.isFunctionApp);
    }

    try {
        ext.outputChannel.appendLog(localize('deployStart', 'Starting deployment...'), { resourceName: client.fullName });
        let asp: AppServicePlan | undefined;

        // if a user has access to the app but not the plan, this will cause an error.  We will make the same assumption as below in this case.
        try {
            asp = await aspPromise;
        } catch {
            asp = undefined;
        }

        let useStorageAccountDeploy: boolean = false;
        if (client.isFunctionApp && client.isLinux) {
            const doBuildKey: string = 'scmDoBuildDuringDeployment';
            const doBuild: boolean | undefined = !!vscode.workspace.getConfiguration('azureFunctions', vscode.Uri.file(fsPath)).get<boolean>(doBuildKey);
            context.telemetry.properties.scmDoBuildDuringDeployment = String(doBuild);
            const isConsumption: boolean = await client.getIsConsumption();
            await validateLinuxFunctionAppSettings(context, client, doBuild, isConsumption);
            useStorageAccountDeploy = !doBuild && isConsumption;
        }

        let shouldSyncTriggers: boolean;
        if (useStorageAccountDeploy) {
            await deployToStorageAccount(client, zipFilePath);
            shouldSyncTriggers = true;
        } else {
            const kuduClient: KuduClient = await client.getKuduClient();
            await kuduClient.pushDeployment.zipPushDeploy(fs.createReadStream(zipFilePath), { isAsync: true, author: 'VS Code' });
            const fullLog: string = await waitForDeploymentToComplete(context, client);
            shouldSyncTriggers = client.isFunctionApp && !/syncing/i.test(fullLog); // No need to sync triggers if kudu already did it

            // https://github.com/Microsoft/vscode-azureappservice/issues/644
            // This delay is a temporary stopgap that should be resolved with the new pipelines
            await delayFirstWebAppDeploy(client, asp);
        }

        if (shouldSyncTriggers) {
            await syncTriggersPostDeploy(client);
        }
    } finally {
        if (createdZip) {
            await fse.remove(zipFilePath);
        }
    }
}

async function getZipFileToDeploy(fsPath: string, isFunctionApp: boolean): Promise<string> {
    if ((await fse.lstat(fsPath)).isDirectory()) {
        if (isFunctionApp) {
            return FileUtilities.zipDirectoryGitignore(fsPath, '.funcignore');
        } else {
            const zipDeployConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('appService', vscode.Uri.file(fsPath));
            const globPattern: string | undefined = zipDeployConfig.get<string>('zipGlobPattern');
            const ignorePattern: string | string[] | undefined = zipDeployConfig.get<string | string[]>('zipIgnorePattern');
            return FileUtilities.zipDirectoryGlob(fsPath, globPattern, ignorePattern);
        }
    } else {
        return FileUtilities.zipFile(fsPath);
    }
}

async function delayFirstWebAppDeploy(client: SiteClient, asp: AppServicePlan | undefined): Promise<void> {
    await new Promise<void>(async (resolve: () => void): Promise<void> => {
        setTimeout(resolve, 10000);
        try {
            // this delay is only valid for the first deployment to a Linux web app on a basic asp, so resolve for anything else
            if (client.isFunctionApp) {
                resolve();
            }
            if (!asp || !asp.sku || !asp.sku.tier || asp.sku.tier.toLowerCase() !== 'basic') {
                resolve();
            }
            if (!client.isLinux) {
                resolve();
            }

            const kuduClient: KuduClient = await client.getKuduClient();
            const deployments: number = (await kuduClient.deployment.getDeployResults()).length;
            if (deployments > 1) {
                resolve();
            }
        } catch (error) {
            // ignore the error, an error here isn't a deployment failure
            resolve();
        }
    });
}

async function validateLinuxFunctionAppSettings(context: IActionContext, client: SiteClient, doBuild: boolean, isConsumption: boolean): Promise<void> {
    const appSettings: StringDictionary = await client.listApplicationSettings();
    // tslint:disable-next-line:strict-boolean-expressions
    appSettings.properties = appSettings.properties || {};

    let hasChanged: boolean = false;

    const keysToRemove: string[] = [
        'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING',
        'WEBSITE_CONTENTSHARE'
    ];

    if (doBuild) {
        keysToRemove.push(
            'WEBSITE_RUN_FROM_ZIP',
            'WEBSITE_RUN_FROM_PACKAGE'
        );
    }

    if (!isConsumption) {
        const dedicatedBuildSettings: [string, string][] = [
            ['ENABLE_ORYX_BUILD', 'true'],
            ['SCM_DO_BUILD_DURING_DEPLOYMENT', '1'],
            ['BUILD_FLAGS', 'UseExpressBuild'],
            ['XDG_CACHE_HOME', '/tmp/.cache']
        ];

        for (const [key, value] of dedicatedBuildSettings) {
            if (!doBuild) {
                keysToRemove.push(key);
            } else if (appSettings.properties[key] !== value) {
                appSettings.properties[key] = value;
                hasChanged = true;
            }
        }
    }

    for (const key of keysToRemove) {
        if (appSettings.properties[key]) {
            delete appSettings.properties[key];
            hasChanged = true;
        }
    }

    if (hasChanged) {
        context.telemetry.properties.updatedAppSettings = 'true';
        await client.updateApplicationSettings(appSettings);
    }
}
