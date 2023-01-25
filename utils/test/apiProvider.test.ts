/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { AzureExtensionApi, AzureExtensionApiProvider } from '../api';
import { AzureExtensionApiFactory, IParsedError } from '../index';
import { createApiProvider } from '../src/createApiProvider';
import { parseError } from '../src/parseError';
import { assertThrowsAsync } from './assertThrowsAsync';

class TestApiFactory implements AzureExtensionApiFactory<TestApi> {
    constructor(public readonly apiVersion: string) { }

    createApi() {
        return new TestApi(this.apiVersion);
    }
}

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
        assert.throws(() => createApiProvider([new TestApiFactory('invalidVersion')]), /Invalid semver/);

        const api1: TestApiFactory = new TestApiFactory('1.0.0');
        const api11: TestApiFactory = new TestApiFactory('1.1.0');
        const api111: TestApiFactory = new TestApiFactory('1.1.1');
        const api12: TestApiFactory = new TestApiFactory('1.2.0');
        const apiProvider: AzureExtensionApiProvider = await createApiProvider([api1, api111, api11, api12]);

        /* eslint-disable @typescript-eslint/no-unsafe-return */
        assert.throws(() => apiProvider.getApi('0.1'), (error) => validateApiError(error, /no longer supported/, 'NoLongerSupported'));
        assert.throws(() => apiProvider.getApi('1.1.2'), (error) => validateApiError(error, /must be updated/, 'NotYetSupported'));
        assert.throws(() => apiProvider.getApi('2'), (error) => validateApiError(error, /must be updated/, 'NotYetSupported'));
        /* eslint-enable @typescript-eslint/no-unsafe-return */

        const latestApi12: TestApi = apiProvider.getApi<TestApi>('1');
        assert.equal(latestApi12.apiVersion, '1.2.0');

        const latestApi11: TestApi = apiProvider.getApi<TestApi>('1.1');
        assert.equal(latestApi11.apiVersion, '1.1.1');

        const latestApi11Carot: TestApi = apiProvider.getApi<TestApi>('^1.1.0');
        assert.equal(latestApi11Carot.apiVersion, '1.2.0');

        const latestApi11Tilde: TestApi = apiProvider.getApi<TestApi>('~1.1.0');
        assert.equal(latestApi11Tilde.apiVersion, '1.1.1');

        const emptyApiProvider: AzureExtensionApiProvider = await createApiProvider([]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        assert.throws(() => emptyApiProvider.getApi('^1.0.0'), (error) => validateApiError(error, /must be updated/, 'NotYetSupported'));
    });

    test('Wrapped api is same as original api', async () => {
        const apiFactory: TestApiFactory = new TestApiFactory('1.0.0');
        const apiProvider: AzureExtensionApiProvider = await createApiProvider([apiFactory]);
        const api = apiFactory.createApi();

        const wrappedApi: TestApi = apiProvider.getApi<TestApi>('1');

        assert.equal(wrappedApi.testProp, api.testProp);
        assert.equal(wrappedApi.testFunc(), api.testFunc());
        assert.equal(await wrappedApi.testFuncAsync(), await api.testFuncAsync());
        assert.equal(wrappedApi.testFuncThisProp(), api.testFuncThisProp());
        assert.throws(wrappedApi.testFuncError, /testFuncError/);
        await assertThrowsAsync(wrappedApi.testFuncErrorAsync, /testFuncErrorAsync/);
    });
});

function validateApiError(error: unknown, regexp: RegExp, expectedCode: string): boolean {
    const errorInfo: IParsedError = parseError(error);
    return regexp.test(errorInfo.message) && errorInfo.errorType === expectedCode;
}
