/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan } from 'azure-arm-website/lib/models';
import { KuduClient } from 'vscode-azurekudu';
import { SiteClient } from '../SiteClient';

export async function delayFirstWebAppDeploy(client: SiteClient, asp: AppServicePlan | undefined): Promise<void> {
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
