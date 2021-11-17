/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { WebSiteManagementModels } from '@azure/arm-appservice';
import { createKuduClient } from '../createKuduClient';
import { ParsedSite } from '../SiteClient';
import { delayFirstWebAppDeploy } from './delayFirstWebAppDeploy';
import { IDeployContext } from './IDeployContext';
import { runWithZipStream } from './runWithZipStream';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function deployZip(context: IDeployContext, site: ParsedSite, fsPath: string, aspPromise: Promise<WebSiteManagementModels.AppServicePlan | undefined>, pathFileMap?: Map<string, string>): Promise<void> {
    const kuduClient = await createKuduClient(context, site);

    await runWithZipStream(context, {
        fsPath, site, pathFileMap,
        callback: async zipStream => {
            await kuduClient.pushDeployment.zipPushDeploy(() => zipStream, { isAsync: true, author: 'VS Code' });
        }
    });

    await waitForDeploymentToComplete(context, site);

    // https://github.com/Microsoft/vscode-azureappservice/issues/644
    // This delay is a temporary stopgap that should be resolved with the new pipelines
    await delayFirstWebAppDeploy(context, site, aspPromise);
}
