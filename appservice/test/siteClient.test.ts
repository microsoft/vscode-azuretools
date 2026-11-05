/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference types="mocha" />

import { Site, WebSiteManagementClient } from '@azure/arm-appservice';
import type { ISubscriptionContext } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import { mock } from 'node:test';
import { ParsedSite, SiteClient } from '../src/SiteClient';

suite('ParsedSite serverFarmId parsing', () => {
    const subscription = {} as unknown as ISubscriptionContext;

    function createSite(serverFarmId: string): Site {
        return {
            id: '/subscriptions/sub/resourceGroups/site-rg/providers/Microsoft.Web/sites/my-site',
            name: 'my-site',
            resourceGroup: 'site-rg',
            kind: 'app',
            defaultHostName: 'my-site.azurewebsites.net',
            hostNameSslStates: [],
            serverFarmId,
        } as unknown as Site;
    }

    // Azure resource ids are case-insensitive, and the ARM API commonly returns the server farm id
    // with a capital-F 'serverFarms' segment. This used to throw 'Invalid serverFarmId.' because the
    // parser matched a hardcoded lowercase 'serverfarms' segment.
    test('parses a capital-F "serverFarms" segment (regression)', () => {
        const site = new ParsedSite(createSite('/subscriptions/sub/resourceGroups/plan-rg/providers/Microsoft.Web/serverFarms/my-plan'), subscription);
        assert.strictEqual(site.planResourceGroup, 'plan-rg');
        assert.strictEqual(site.planName, 'my-plan');
    });

    test('parses a lowercase "serverfarms" segment', () => {
        const site = new ParsedSite(createSite('/subscriptions/sub/resourceGroups/plan-rg/providers/Microsoft.Web/serverfarms/my-plan'), subscription);
        assert.strictEqual(site.planResourceGroup, 'plan-rg');
        assert.strictEqual(site.planName, 'my-plan');
    });

    test('parses an all-caps provider/type segment', () => {
        const site = new ParsedSite(createSite('/subscriptions/sub/resourceGroups/plan-rg/providers/MICROSOFT.WEB/SERVERFARMS/my-plan'), subscription);
        assert.strictEqual(site.planResourceGroup, 'plan-rg');
        assert.strictEqual(site.planName, 'my-plan');
    });

    test('throws for a well-formed id of the wrong resource type', () => {
        assert.throws(
            () => new ParsedSite(createSite('/subscriptions/sub/resourceGroups/plan-rg/providers/Microsoft.Web/sites/not-a-plan'), subscription),
            /Invalid serverFarmId\./,
        );
    });

    test('throws for a malformed serverFarmId', () => {
        assert.throws(
            () => new ParsedSite(createSite('not-a-resource-id'), subscription),
            /Invalid Azure Resource Id/,
        );
    });
});

suite('SiteClient restart', () => {
        const subscription = {} as ISubscriptionContext;
        const credentials = { getToken: () => Promise.resolve({ token: 'test-token', expiresOnTimestamp: Date.now() + 60000 }) };

        teardown(() => mock.restoreAll());

        for (const slotName of [undefined, 'staging']) {
            const target = slotName ? 'deployment slot' : 'production site';

            function createClient(): { client: SiteClient; internalClient: WebSiteManagementClient } {
                const site = new ParsedSite({
                    id: `/subscriptions/sub/resourceGroups/site-rg/providers/Microsoft.Web/sites/my-site${slotName ? `/slots/${slotName}` : ''}`,
                    name: `my-site${slotName ? `/${slotName}` : ''}`,
                    resourceGroup: 'site-rg',
                    location: 'westus',
                    kind: 'app',
                    defaultHostName: 'my-site.azurewebsites.net',
                    hostNameSslStates: [],
                    serverFarmId: '/subscriptions/sub/resourceGroups/plan-rg/providers/Microsoft.Web/serverfarms/my-plan',
                }, subscription);
                const internalClient = new WebSiteManagementClient(credentials, 'sub', {
                    httpClient: { sendRequest: () => Promise.reject(new Error('Unexpected HTTP request')) }
                });
                return { client: new SiteClient(internalClient, site), internalClient };
            }

            test(`awaits the native restart operation for a ${target} without stopping or starting`, async () => {
                const { client, internalClient } = createClient();
                let completeRestart: () => void = () => assert.fail('Restart was not invoked');
                const pendingRestart = new Promise<void>(resolve => { completeRestart = resolve; });
                const restart = mock.method(internalClient.webApps, 'restart', () => pendingRestart);
                const restartSlot = mock.method(internalClient.webApps, 'restartSlot', () => pendingRestart);
                const lifecycleCalls = (['stop', 'stopSlot', 'start', 'startSlot'] as const).map(method =>
                    mock.method(internalClient.webApps, method, () => Promise.reject(new Error('Restart must not stop or start the site'))));

                let completed = false;
                const result = client.restart().then(() => { completed = true; });
                await Promise.resolve();
                assert.strictEqual(completed, false);
                assert.strictEqual(restart.mock.callCount(), slotName ? 0 : 1);
                assert.strictEqual(restartSlot.mock.callCount(), slotName ? 1 : 0);
                assert.deepStrictEqual(
                    (slotName ? restartSlot : restart).mock.calls[0].arguments,
                    slotName ? ['site-rg', 'my-site', slotName] : ['site-rg', 'my-site']
                );
                completeRestart();
                assert.strictEqual(await result, undefined);
                assert.strictEqual(completed, true);
                for (const call of lifecycleCalls) {
                    assert.strictEqual(call.mock.callCount(), 0);
                }
            });

            test(`propagates native restart failures for a ${target}`, async () => {
                const { client, internalClient } = createClient();
                const error = new Error('Restart failed');
                mock.method(internalClient.webApps, slotName ? 'restartSlot' : 'restart', () => Promise.reject(error));
                await assert.rejects(client.restart(), actual => actual === error);
            });
        }
});
