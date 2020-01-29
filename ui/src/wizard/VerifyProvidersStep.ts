/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient, ResourceModels } from 'azure-arm-resource';
import { Progress } from 'vscode';
import * as types from '../../index';
import { createAzureClient } from '../createAzureClient';
import { localize } from '../localize';
import { delay } from '../utils/delay';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';

export class VerifyProvidersStep<T extends types.ISubscriptionWizardContext> extends AzureWizardExecuteStep<T> implements types.VerifyProvidersStep<T> {
    public priority: number = 90;
    private _providers: string[];

    public constructor(providers: string[]) {
        super();
        this._providers = providers;
    }

    public async execute(context: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        progress.report({ message: localize('registeringProviders', 'Registering Providers...') });

        const client: ResourceManagementClient = createAzureClient(context, ResourceManagementClient);
        await Promise.all(this._providers.map(async providerName => {
            try {
                let provider: ResourceModels.Provider = await client.providers.get(providerName);
                if (provider.registrationState?.toLowerCase() !== 'registered') {
                    await client.providers.register(providerName);

                    // The register call doesn't actually wait for register to finish, so we will poll for state
                    // Also, creating a resource seems to work even if it's in the 'registering' state (which can last several minutes), so we won't wait longer than 30 seconds
                    const maxTime: number = Date.now() + 30 * 1000;
                    do {
                        await delay(2 * 1000);
                        provider = await client.providers.get(providerName);
                    } while (provider.registrationState?.toLowerCase() === 'registering' && Date.now() < maxTime);
                }
            } catch {
                // ignore and continue with wizard. An error here would likely be confusing and un-actionable
            }
        }));
    }

    public shouldExecute(_context: T): boolean {
        return true;
    }
}
