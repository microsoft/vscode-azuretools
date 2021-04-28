/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import * as fse from 'fs-extra';
import * as vscode from 'vscode';
import { createKuduClient } from '../createKuduClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { delayFirstWebAppDeploy } from './delayFirstWebAppDeploy';
import { deployToStorageAccount } from './deployToStorageAccount';
import { IDeployContext } from './IDeployContext';
import { runWithZipStream } from './runWithZipStream';
import { validateLinuxFunctionAppSettings } from './validateLinuxFunctionAppSettings';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function deployZip(context: IDeployContext, client: SiteClient, fsPath: string, aspPromise: Promise<WebSiteManagementModels.AppServicePlan | undefined>): Promise<void> {
    if (!(await fse.pathExists(fsPath))) {
        throw new Error(localize('pathNotExist', 'Failed to deploy path that does not exist: {0}', fsPath));
    }

    ext.outputChannel.appendLog(localize('deployStart', 'Starting deployment...'), { resourceName: client.fullName });
    let asp: WebSiteManagementModels.AppServicePlan | undefined;

    // if a user has access to the app but not the plan, this will cause an error.  We will make the same assumption as below in this case.
    try {
        asp = await aspPromise;
    } catch {
        asp = undefined;
    }

    let useStorageAccountDeploy: boolean = false;
    if (client.isFunctionApp && client.isLinux) {
        const doBuildKey: string = 'scmDoBuildDuringDeployment';
        const doBuild: boolean | undefined = !!vscode.workspace.getConfiguration(ext.prefix, vscode.Uri.file(fsPath)).get<boolean>(doBuildKey);
        context.telemetry.properties.scmDoBuildDuringDeployment = String(doBuild);
        const isConsumption: boolean = await client.getIsConsumption();
        await validateLinuxFunctionAppSettings(context, client, doBuild, isConsumption);
        useStorageAccountDeploy = !doBuild && isConsumption;
    }

    context.telemetry.properties.useStorageAccountDeploy = String(useStorageAccountDeploy);
    if (useStorageAccountDeploy) {
        await deployToStorageAccount(context, fsPath, client);
        context.syncTriggersPostDeploy = true;
    } else {
        const kuduClient = await createKuduClient(client);

        await runWithZipStream(context, fsPath, client, async zipStream => {
            await kuduClient.pushDeployment.zipPushDeploy(() => zipStream, { isAsync: true, author: 'VS Code' });
        });

        await waitForDeploymentToComplete(context, client);

        // https://github.com/Microsoft/vscode-azureappservice/issues/644
        // This delay is a temporary stopgap that should be resolved with the new pipelines
        await delayFirstWebAppDeploy(client, asp);
    }
}
