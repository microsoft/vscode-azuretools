/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { createKuduClient } from '../createKuduClient';
import { SiteClient } from '../SiteClient';
import { delayFirstWebAppDeploy } from './delayFirstWebAppDeploy';
import { IDeployContext } from './IDeployContext';
import { Readable } from 'stream';
import * as yazl from 'yazl';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function deployJar(context: IDeployContext, client: SiteClient, fsPath: string, aspPromise: Promise<WebSiteManagementModels.AppServicePlan | undefined>): Promise<void> {
    const kuduClient = await createKuduClient(context, client);

    const zipFile = new yazl.ZipFile();
    zipFile.addFile(fsPath, "app.jar"); // For Java SE runtime, need rename the artifact to app.jar
    zipFile.end();

    const zipStream: Readable = new Readable().wrap(zipFile.outputStream);

    await kuduClient.pushDeployment.zipPushDeploy(() => zipStream, { isAsync: true, author: 'VS Code' });

    await waitForDeploymentToComplete(context, client);

    // https://github.com/Microsoft/vscode-azureappservice/issues/644
    // This delay is a temporary stopgap that should be resolved with the new pipelines
    await delayFirstWebAppDeploy(context, client, aspPromise);
}
