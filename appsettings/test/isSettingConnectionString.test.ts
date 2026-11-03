/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { isSettingConnectionString } from '../src/utils/isSettingConnectionString';

suite('isSettingConnectionString', () => {
    test('recognizes storage, Service Bus, Event Hub and Cosmos connections', () => {
        for (const value of [
            'DefaultEndpointsProtocol=https;AccountName=account;AccountKey=secret;EndpointSuffix=core.windows.net',
            'Endpoint=sb://example/;SharedAccessKeyName=name;SharedAccessKey=secret',
            'Endpoint=sb://example/;SharedAccessKeyName=name;SharedAccessKey=secret;EntityPath=hub',
            'AccountEndpoint=https://example/;AccountKey=secret;',
            'prefixEndpoint=sb://example/;SharedAccessKeyName=name;SharedAccessKey=secret;extra=value',
        ]) {
            assert.strictEqual(isSettingConnectionString('setting', value), true, value);
        }
    });

    test('preserves exclusions, ordering, case and nonempty-field requirements', () => {
        for (const value of [
            '',
            'UseDevelopmentStorage=true',
            'Endpoint=sb://;SharedAccessKeyName=name;SharedAccessKey=secret',
            'Endpoint=sb://example/;SharedAccessKeyName=;SharedAccessKey=secret',
            'Endpoint=sb://example/;SharedAccessKeyName=name;SharedAccessKey=',
            'Endpoint=sb://example/;SharedAccessKey=secret;SharedAccessKeyName=name',
            'endpoint=sb://example/;SharedAccessKeyName=name;SharedAccessKey=secret',
            'AccountEndpoint=https://example/;AccountKey=secret',
            'AccountEndpoint=https://;AccountKey=secret;',
            'AccountEndpoint=https://example/;AccountKey=;',
        ]) {
            assert.strictEqual(isSettingConnectionString('setting', value), false, value);
        }
        assert.strictEqual(isSettingConnectionString('DEPLOYMENT_STORAGE_CONNECTION_STRING', 'AccountEndpoint=https://example/;AccountKey=secret;'), false);
    });

    test('handles long repeated endpoint prefixes', () => {
        for (const fragment of ['Endpoint=sb://', 'AccountEndpoint=https://']) {
            assert.strictEqual(isSettingConnectionString('setting', fragment.repeat(10000)), false);
        }
    });
});
