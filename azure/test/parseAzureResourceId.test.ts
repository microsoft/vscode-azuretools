/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference types="mocha" />

import * as assert from 'assert';
import { getResourceGroupFromId, parseAzureResourceGroupId, parseAzureResourceId } from '../src/utils/parseAzureResourceId';

suite('parseAzureResourceId', () => {
    // Azure resource ids are case-insensitive, so the parser must handle whatever casing the
    // ARM API returns for the provider/type segment (e.g. `serverFarms` vs `serverfarms`).
    const cases = [
        { type: 'web app', id: '/subscriptions/sub-id/resourceGroups/my-rg/providers/Microsoft.Web/sites/my-site', provider: 'Microsoft.Web/sites', resourceName: 'my-site' },
        { type: 'storage account', id: '/subscriptions/sub-id/resourceGroups/my-rg/providers/Microsoft.Storage/storageAccounts/mystorage', provider: 'Microsoft.Storage/storageAccounts', resourceName: 'mystorage' },
        { type: 'log analytics workspace', id: '/subscriptions/sub-id/resourceGroups/my-rg/providers/Microsoft.OperationalInsights/workspaces/my-workspace', provider: 'Microsoft.OperationalInsights/workspaces', resourceName: 'my-workspace' },
        { type: 'app service plan with capital-F serverFarms', id: '/subscriptions/sub-id/resourceGroups/my-rg/providers/Microsoft.Web/serverFarms/my-plan', provider: 'Microsoft.Web/serverFarms', resourceName: 'my-plan' },
    ];

    for (const c of cases) {
        test(`parses ${c.type}`, () => {
            const parsed = parseAzureResourceId(c.id);
            assert.strictEqual(parsed.subscriptionId, 'sub-id');
            assert.strictEqual(parsed.resourceGroup, 'my-rg');
            assert.strictEqual(parsed.provider, c.provider);
            assert.strictEqual(parsed.resourceName, c.resourceName);
            assert.strictEqual(parsed.rawId, c.id);
        });
    }

    test('is case-insensitive for the structural segments', () => {
        const parsed = parseAzureResourceId('/SUBSCRIPTIONS/sub-id/RESOURCEGROUPS/my-rg/PROVIDERS/Microsoft.Web/sites/my-site');
        assert.strictEqual(parsed.subscriptionId, 'sub-id');
        assert.strictEqual(parsed.resourceGroup, 'my-rg');
        assert.strictEqual(parsed.resourceName, 'my-site');
    });

    test('throws for a malformed id', () => {
        assert.throws(() => parseAzureResourceId('not-a-resource-id'), /Invalid Azure Resource Id/);
    });

    test('throws for a resource-group-only id (no provider segment)', () => {
        assert.throws(() => parseAzureResourceId('/subscriptions/sub-id/resourceGroups/my-rg'), /Invalid Azure Resource Id/);
    });
});

suite('parseAzureResourceGroupId', () => {
    test('extracts subscription and resource group from a full resource id', () => {
        const parsed = parseAzureResourceGroupId('/subscriptions/sub-id/resourceGroups/my-rg/providers/Microsoft.Web/sites/my-site');
        assert.strictEqual(parsed.subscriptionId, 'sub-id');
        assert.strictEqual(parsed.resourceGroup, 'my-rg');
    });

    test('extracts from a bare resource group id', () => {
        const parsed = parseAzureResourceGroupId('/subscriptions/sub-id/resourceGroups/my-rg');
        assert.strictEqual(parsed.subscriptionId, 'sub-id');
        assert.strictEqual(parsed.resourceGroup, 'my-rg');
    });

    test('is case-insensitive', () => {
        const parsed = parseAzureResourceGroupId('/SUBSCRIPTIONS/sub-id/RESOURCEGROUPS/my-rg');
        assert.strictEqual(parsed.resourceGroup, 'my-rg');
    });

    test('throws for a malformed id', () => {
        assert.throws(() => parseAzureResourceGroupId('not-a-resource-id'), /Invalid Azure Resource Group Id/);
    });
});

suite('getResourceGroupFromId', () => {
    test('returns the resource group from a full resource id', () => {
        assert.strictEqual(
            getResourceGroupFromId('/subscriptions/sub-id/resourceGroups/my-rg/providers/Microsoft.Web/sites/my-site'),
            'my-rg',
        );
    });
});
