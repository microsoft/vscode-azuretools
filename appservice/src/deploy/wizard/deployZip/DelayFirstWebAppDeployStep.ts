/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AppServicePlan } from '@azure/arm-appservice';
import { AzureWizardExecuteStep } from '@microsoft/vscode-azext-utils';
import { InnerDeployContext } from '../../IDeployContext';

export class DelayFirstWebAppDeployStep extends AzureWizardExecuteStep<InnerDeployContext> {
    public priority: number = 300;
    public constructor(readonly aspPromise: Promise<AppServicePlan | undefined>) {
        super();
    }

    public async execute(context: InnerDeployContext): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
        await new Promise<void>(async (resolve: () => void): Promise<void> => {
            setTimeout(resolve, 10000);
            try {
                // this delay is only valid for the first deployment to a Linux web app on a basic asp, so resolve for anything else
                if (context.site.isFunctionApp) {
                    resolve();
                }

                const asp: AppServicePlan | undefined = await this.aspPromise;
                if (!asp || !asp.sku || !asp.sku.tier || asp.sku.tier.toLowerCase() !== 'basic') {
                    resolve();
                }
                if (!context.site.isLinux) {
                    resolve();
                }

                const deployments: number = (await context.client.getDeployResults(context)).length;
                if (deployments > 1) {
                    resolve();
                }
            } catch (error) {
                // ignore the error, an error here isn't a deployment failure
                resolve();
            }
        });
    }

    public shouldExecute(_context: InnerDeployContext): boolean {
        return true;
    }
}
