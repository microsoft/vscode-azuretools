/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Provider, ResourceManagementClient } from '@azure/arm-resources';
import { AzureWizardExecuteStep, IParsedError, ISubscriptionActionContext, maskUserInfo, parseError } from '@microsoft/vscode-azext-utils';
import { l10n, Progress } from 'vscode';
import * as types from '../../index';
import { createResourcesClient } from '../clients';
import { delay } from '../utils/delay';

export class VerifyProvidersStep<T extends ISubscriptionActionContext> extends AzureWizardExecuteStep<T> implements types.VerifyProvidersStep<T> {
    public priority: number = 90;
    private _providers: string[];

    public constructor(providers: string[]) {
        super();
        this._providers = providers;
    }

    public async execute(context: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        progress.report({ message: l10n.t('Registering Providers...') });

        const client: ResourceManagementClient = await createResourcesClient(context);
        await Promise.all(this._providers.map(async providerName => {
            try {
                let provider: Provider = await client.providers.get(providerName);
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
            } catch (error) {
                // ignore and continue with wizard. An error here would likely be confusing and un-actionable
                const perror: IParsedError = parseError(error);
                const maskedErrorMessage: string = maskUserInfo(perror.message, []);

                /**
                 * @param providerError
                 * @deprecated
                 * Continue to emit telemetry for clients who are still using this property. You should suppress this property if you need to migrate to the new replacement.
                 *
                 * @param providerErrorV2
                 * A duplicate replacement of the `providerError` telemetry property.
                 */
                context.telemetry.properties.providerError = maskedErrorMessage;
                context.telemetry.properties.providerErrorV2 = maskedErrorMessage;
            }
        }));
    }

    public shouldExecute(_context: T): boolean {
        return true;
    }
}
