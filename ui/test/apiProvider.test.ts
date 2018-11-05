/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { AzureExtensionApi, AzureExtensionApiProvider } from '../api';
import { wrapApiWithVersioning } from '../src/wrapApiWithVersioning';
import { assertThrowsAsync } from './assertThrowsAsync';

class TestApi implements AzureExtensionApi {
    public testProp: string = 'testProp';
    public apiVersion: string;

    constructor(apiVersion: string) {
        this.apiVersion = apiVersion;
    }

    public testFunc(): string {
        return 'testFunc';
    }

    public async testFuncAsync(): Promise<string> {
        return Promise.resolve('testFuncAsync');
    }

    public testFuncError(): string {
        throw new Error('testFuncError');
    }

    public async testFuncErrorAsync(): Promise<string> {
        throw new Error('testFuncErrorAsync');
    }

    public testFuncThisProp(): string {
        return this.testProp;
    }
}

suite('AzureExtensionApiProvider tests', () => {
    test('Versioning', async () => {
        assert.throws(() => wrapApiWithVersioning([new TestApi('invalidVersion')]), /Invalid semver/);

        const api1: TestApi = new TestApi('1.0.0');
        const api11: TestApi = new TestApi('1.1.0');
        const api111: TestApi = new TestApi('1.1.1');
        const api12: TestApi = new TestApi('1.2.0');
        const apiProvider: AzureExtensionApiProvider = wrapApiWithVersioning([api1, api111, api11, api12]);

        assert.throws(() => apiProvider.getApi('0.1'), /no longer supported/);
        assert.throws(() => apiProvider.getApi('1.1.2'), /must be updated/);
        assert.throws(() => apiProvider.getApi('2'), /must be updated/);

        const latestApi12: TestApi = apiProvider.getApi<TestApi>('1');
        assert.equal(latestApi12.apiVersion, '1.2.0');

        const latestApi11: TestApi = apiProvider.getApi<TestApi>('1.1');
        assert.equal(latestApi11.apiVersion, '1.1.1');

        const latestApi11Carot: TestApi = apiProvider.getApi<TestApi>('^1.1.0');
        assert.equal(latestApi11Carot.apiVersion, '1.2.0');

        const latestApi11Tilde: TestApi = apiProvider.getApi<TestApi>('~1.1.0');
        assert.equal(latestApi11Tilde.apiVersion, '1.1.1');
    });

    test('Wrapped api is same as original api', async () => {
        const api: TestApi = new TestApi('1.0.0');
        const apiProvider: AzureExtensionApiProvider = wrapApiWithVersioning([api]);

        const wrappedApi: TestApi = apiProvider.getApi<TestApi>('1');

        assert.equal(wrappedApi.testProp, api.testProp);
        assert.equal(wrappedApi.testFunc(), api.testFunc());
        assert.equal(await wrappedApi.testFuncAsync(), await api.testFuncAsync());
        assert.equal(wrappedApi.testFuncThisProp(), api.testFuncThisProp());
        assert.throws(wrappedApi.testFuncError, /testFuncError/);
        await assertThrowsAsync(wrappedApi.testFuncErrorAsync, /testFuncErrorAsync/);
    });
});
