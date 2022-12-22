/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AppServicePlan } from '@azure/arm-appservice';
import { IActionContext } from '@microsoft/vscode-azext-utils';
import { ParsedSite } from '../SiteClient';

export async function delayFirstWebAppDeploy(context: IActionContext, site: ParsedSite, aspPromise: Promise<AppServicePlan | undefined>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    await new Promise<void>(async (resolve: () => void): Promise<void> => {
        setTimeout(resolve, 10000);
        try {
            // this delay is only valid for the first deployment to a Linux web app on a basic asp, so resolve for anything else
            if (site.isFunctionApp) {
                resolve();
            }

            const asp: AppServicePlan | undefined = await aspPromise;
            if (!asp || !asp.sku || !asp.sku.tier || asp.sku.tier.toLowerCase() !== 'basic') {
                resolve();
            }
            if (!site.isLinux) {
                resolve();
            }

            const kuduClient = await site.createClient(context);
            const deployments: number = (await kuduClient.listDeployments()).length;
            if (deployments > 1) {
                resolve();
            }
        } catch (error) {
            // ignore the error, an error here isn't a deployment failure
            resolve();
        }
    });
}
