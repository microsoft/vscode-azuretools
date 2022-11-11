/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AppServicePlan } from '@azure/arm-appservice';
import { publisherName } from '../constants';
import { createKuduClient } from '../createKuduClient';
import { ParsedSite } from '../SiteClient';
import { delayFirstWebAppDeploy } from './delayFirstWebAppDeploy';
import { IDeployContext } from './IDeployContext';
import { runWithZipStream } from './runWithZipStream';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function deployZip(context: IDeployContext, site: ParsedSite, fsPath: string, aspPromise: Promise<AppServicePlan | undefined>, pathFileMap?: Map<string, string>): Promise<void> {
    const kuduClient = await createKuduClient(context, site);

    const response = await runWithZipStream(context, {
        fsPath, site, pathFileMap,
        callback: async zipStream => {
            return await kuduClient.pushDeployment.zipPushDeploy(() => zipStream, {
                isAsync: true,
                author: publisherName,
                deployer: publisherName,
                trackDeploymentId: true
            });
        }
    });
    let locationUrl: string | undefined;
    try {
        if (response) {
            context.telemetry.properties.deploymentId = response._response.headers.get('scm-deployment-id');
            locationUrl = response._response.headers.get('location');
        }
    } catch (e) {
        // swallow errors, we don't want a failure here to block deployment
    }

    await waitForDeploymentToComplete(context, site, { locationUrl });

    // https://github.com/Microsoft/vscode-azureappservice/issues/644
    // This delay is a temporary stopgap that should be resolved with the new pipelines
    await delayFirstWebAppDeploy(context, site, aspPromise);
}
