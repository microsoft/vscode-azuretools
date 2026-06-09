/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type { AccessToken, GetTokenOptions, TokenCredential } from '@azure/core-auth';
import { AzureDevOpsCredential, type ResolvedAzureDevOpsCredentialInit } from '../../src/next/testing';

// #region Fakes

function fakeTokenCredential(token: string = 'devops-token'): TokenCredential {
    return {
        getToken: (_scopes: string | string[], _options?: GetTokenOptions): Promise<AccessToken> =>
            Promise.resolve({ token, expiresOnTimestamp: Date.now() + 3600 * 1000 }),
    };
}

const baseInit = { serviceConnectionId: 'service-connection', tenantId: 'tenant-1', clientId: 'client-1' };

// #endregion

suite('(unit) next/testing', () => {
    suite('AzureDevOpsCredential', () => {
        test('throws when required initializer values are missing', () => {
            assert.throws(() => new AzureDevOpsCredential({ serviceConnectionId: '', tenantId: 't', clientId: 'c' }));
            assert.throws(() => new AzureDevOpsCredential({ serviceConnectionId: 's', tenantId: '', clientId: 'c' }));
            assert.throws(() => new AzureDevOpsCredential({ serviceConnectionId: 's', tenantId: 't', clientId: '' }));
        });

        test('uses the provided credentialFactory and forwards the resolved init', async () => {
            let received: ResolvedAzureDevOpsCredentialInit | undefined;
            const credential = new AzureDevOpsCredential({
                ...baseInit,
                systemAccessToken: 'system-token',
                credentialFactory: (init) => {
                    received = init;
                    return fakeTokenCredential('from-factory');
                },
            });

            const token = await credential.getToken('https://management.azure.com/.default');

            assert.strictEqual(token?.token, 'from-factory');
            assert.ok(received);
            assert.strictEqual(received.serviceConnectionId, 'service-connection');
            assert.strictEqual(received.tenantId, 'tenant-1');
            assert.strictEqual(received.clientId, 'client-1');
            assert.strictEqual(received.systemAccessToken, 'system-token');
        });

        test('throws when a credentialFactory is provided but no system access token is available', async () => {
            const previous = process.env.SYSTEM_ACCESSTOKEN;
            delete process.env.SYSTEM_ACCESSTOKEN;
            try {
                const credential = new AzureDevOpsCredential({
                    ...baseInit,
                    credentialFactory: () => fakeTokenCredential(),
                });
                await assert.rejects(() => credential.getToken('scope'));
            } finally {
                if (previous !== undefined) {
                    process.env.SYSTEM_ACCESSTOKEN = previous;
                }
            }
        });

        test('lazily creates the inner credential only once', async () => {
            let factoryCalls = 0;
            const credential = new AzureDevOpsCredential({
                ...baseInit,
                systemAccessToken: 'system-token',
                credentialFactory: () => {
                    factoryCalls++;
                    return fakeTokenCredential();
                },
            });

            await credential.getToken('scope');
            await credential.getToken('scope');

            assert.strictEqual(factoryCalls, 1);
        });
    });
});
