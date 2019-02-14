/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan } from 'azure-arm-website/lib/models';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as vscode from 'vscode';
import KuduClient from 'vscode-azurekudu';
import { ext } from '../extensionVariables';
import * as FileUtilities from '../FileUtilities';
import { getKuduClient } from '../getKuduClient';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { deployToStorageAccount } from './deployToStorageAccount';
import { formatDeployLog } from './formatDeployLog';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function deployZip(client: SiteClient, fsPath: string, configurationSectionName: string, aspPromise: Promise<AppServicePlan | undefined>): Promise<void> {
    if (!(await fse.pathExists(fsPath))) {
        throw new Error(localize('pathNotExist', 'Failed to deploy path that does not exist: {0}', fsPath));
    }

    let zipFilePath: string;
    let createdZip: boolean = false;
    if (FileUtilities.getFileExtension(fsPath) === 'zip') {
        zipFilePath = fsPath;
    } else {
        createdZip = true;
        ext.outputChannel.appendLine(formatDeployLog(client, localize('zipCreate', 'Creating zip package...')));
        zipFilePath = await getZipFileToDeploy(fsPath, configurationSectionName);
    }

    try {
        ext.outputChannel.appendLine(formatDeployLog(client, localize('deployStart', 'Starting deployment...')));
        const asp: AppServicePlan | undefined = await aspPromise;
        // Assume it's consumption if we can't get the plan (sometimes happens with brand new plans). Consumption is recommended and more popular for functions
        const isConsumption: boolean = !asp || (!!asp.sku && !!asp.sku.tier && asp.sku.tier.toLowerCase() === 'dynamic');
        if (client.isLinux && isConsumption) {
            // Linux consumption doesn't support kudu zipPushDeploy
            await deployToStorageAccount(client, zipFilePath);
        } else {
            const kuduClient: KuduClient = await getKuduClient(client);
            await kuduClient.pushDeployment.zipPushDeploy(fs.createReadStream(zipFilePath), { isAsync: true });
            await waitForDeploymentToComplete(client, kuduClient);
            // https://github.com/Microsoft/vscode-azureappservice/issues/644
            // This delay is a temporary stopgap that should be resolved with the new pipelines
            await delayFirstWebAppDeploy(client, asp, kuduClient);

        }
    } finally {
        if (createdZip) {
            await fse.remove(zipFilePath);
        }
    }
}

async function getZipFileToDeploy(fsPath: string, configurationSectionName?: string): Promise<string> {
    if (await FileUtilities.isDirectory(fsPath)) {
        const zipDeployConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(configurationSectionName, vscode.Uri.file(fsPath));
        const globPattern: string | undefined = zipDeployConfig.get<string>('zipGlobPattern');
        let ignorePattern: string | string[] | undefined = zipDeployConfig.get<string | string[]>('zipIgnorePattern');

        // add .vscode to the ignorePattern since it will never be needed for deployment
        const vscodeGlobPattern: string = '.vscode{,/**}';
        if (!ignorePattern) {
            ignorePattern = [vscodeGlobPattern];
        } else {
            if (typeof ignorePattern === 'string') {
                ignorePattern = [ignorePattern];
            }
            ignorePattern.push(vscodeGlobPattern);
        }

        return FileUtilities.zipDirectory(fsPath, globPattern, ignorePattern);
    } else {
        return FileUtilities.zipFile(fsPath);
    }
}

async function delayFirstWebAppDeploy(client: SiteClient, asp: AppServicePlan | undefined, kuduClient: KuduClient): Promise<void> {
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
