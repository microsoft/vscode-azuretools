/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference types="mocha" />

import type { TokenCredential } from '@azure/core-auth';
import type { Environment } from '@azure/ms-rest-azure-env';
import * as azureEnv from '@azure/ms-rest-azure-env';
import type { ISubscriptionContext } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import { getAppServiceCredentials, getAppServiceScopes } from '../src/utils/appServiceEnvironment';

suite('appServiceEnvironment', () => {
    test('returns public scope for AzureCloud', () => {
        assert.deepStrictEqual(getAppServiceScopes(azureEnv.Environment.AzureCloud), ['https://appservice.azure.com/.default']);
    });

    test('returns gov scope for AzureUSGovernment', () => {
        assert.deepStrictEqual(getAppServiceScopes(azureEnv.Environment.USGovernment), ['https://appservice.azure.us/.default']);
    });

    test('returns China scope for AzureChinaCloud', () => {
        assert.deepStrictEqual(getAppServiceScopes(azureEnv.Environment.ChinaCloud), ['https://appservice.azure.cn/.default']);
    });

    for (const [environmentName, expectedScope] of Object.entries({
        AzureUSNat: 'https://appservice.azure.eaglex.ic.gov/.default',
        AzureUSSec: 'https://appservice.azure.microsoft.scloud/.default',
        AzureBleu: 'https://appservice.azure.sovcloud-api.fr/.default',
        AzureDelos: 'https://appservice.azure.sovcloud-api.de/.default',
    })) {
        test(`returns expected scope for ${environmentName}`, () => {
            assert.deepStrictEqual(getAppServiceScopes({ name: environmentName } as Environment), [expectedScope]);
        });
    }
});

suite('getAppServiceCredentials', () => {
    const publicScope = 'https://appservice.azure.com/.default';
    const fakeCredentials = {} as TokenCredential;

    function createSubscription(authentication?: unknown): { subscription: ISubscriptionContext, createCredentialsCalls: string[][] } {
        const createCredentialsCalls: string[][] = [];
        const subscription = {
            environment: azureEnv.Environment.AzureCloud,
            createCredentialsForScopes: (scopes: string[]) => {
                createCredentialsCalls.push(scopes);
                return Promise.resolve(fakeCredentials);
            },
            authentication,
        } as unknown as ISubscriptionContext;
        return { subscription, createCredentialsCalls };
    }

    test('eagerly requests interactive consent for the App Service scope, then creates credentials', async () => {
        const sessionCalls: { scopes: string[], options: unknown }[] = [];
        const { subscription, createCredentialsCalls } = createSubscription({
            getSessionWithScopes: (scopes: string[], options: unknown) => {
                sessionCalls.push({ scopes, options });
                return Promise.resolve(undefined);
            },
        });

        const result = await getAppServiceCredentials(subscription);

        assert.deepStrictEqual(sessionCalls, [{ scopes: [publicScope], options: { createIfNone: true } }]);
        assert.deepStrictEqual(createCredentialsCalls, [[publicScope]]);
        assert.strictEqual(result.credentials, fakeCredentials);
        assert.deepStrictEqual(result.scopes, [publicScope]);
    });

    test('still creates credentials when authentication is undefined', async () => {
        const { subscription, createCredentialsCalls } = createSubscription(undefined);

        const result = await getAppServiceCredentials(subscription);

        assert.deepStrictEqual(createCredentialsCalls, [[publicScope]]);
        assert.strictEqual(result.credentials, fakeCredentials);
    });

    test('degrades gracefully when authentication lacks getSessionWithScopes', async () => {
        const { subscription, createCredentialsCalls } = createSubscription({});

        const result = await getAppServiceCredentials(subscription);

        assert.deepStrictEqual(createCredentialsCalls, [[publicScope]]);
        assert.strictEqual(result.credentials, fakeCredentials);
    });
});
