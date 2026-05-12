/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference types="mocha" />

import type { Environment } from '@azure/ms-rest-azure-env';
import * as azureEnv from '@azure/ms-rest-azure-env';
import * as assert from 'assert';
import { getAppServiceScopes } from '../src/utils/appServiceEnvironment';

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
