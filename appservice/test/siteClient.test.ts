/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference types="mocha" />

import type { Site } from '@azure/arm-appservice';
import type { ISubscriptionContext } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import { ParsedSite } from '../src/SiteClient';

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
