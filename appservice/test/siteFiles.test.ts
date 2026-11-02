/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference types="mocha" />

import { WebSiteManagementClient } from '@azure/arm-appservice';
import { ServiceClient } from '@azure/core-client';
import { createHttpHeaders, PipelineRequest, PipelineResponse, RestError } from '@azure/core-rest-pipeline';
import { Environment } from '@azure/ms-rest-azure-env';
import { createTestActionContext, IActionContext, ISubscriptionContext, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import { mock } from 'node:test';
import { Readable } from 'stream';
import { ParsedSite, SiteClient } from '../src/SiteClient';
import { getFile, getFileBytes, putFile } from '../src/siteFiles';

suite('Site file bytes', () => {
    const bytes = Buffer.from([0, 0, 1, 0, 255, 128, 192, 175, 13, 10]);
    const credentials = { getToken: () => Promise.resolve({ token: 'test-token', expiresOnTimestamp: Date.now() + 60000 }) };
    const requestedScopes: string[][] = [];

    function createSite(isFunctionApp = false): ParsedSite {
        const subscription = {
            environment: Environment.AzureCloud,
            credentials,
            createCredentialsForScopes: (scopes: string[]) => {
                requestedScopes.push(scopes);
                return Promise.resolve(credentials);
            }
        } as ISubscriptionContext;
        const site = new ParsedSite({
            id: '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Web/sites/site/slots/staging',
            name: 'site/staging',
            resourceGroup: 'rg',
            location: 'westus',
            kind: isFunctionApp ? 'functionapp,linux' : 'app',
            defaultHostName: 'site-staging.azurewebsites.net',
            hostNameSslStates: [{ hostType: 'Repository', name: 'site-staging.scm.azurewebsites.net' }],
            serverFarmId: '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Web/serverfarms/plan'
        }, subscription);
        site.createClient = () => Promise.resolve(new SiteClient(new WebSiteManagementClient(credentials, 'sub'), site));
        return site;
    }

    function response(request: PipelineRequest, content = bytes): PipelineResponse {
        return {
            request,
            status: 200,
            headers: createHttpHeaders({ etag: '"file-etag"', 'content-type': 'application/json' }),
            readableStreamBody: Readable.from([content.subarray(0, 3), content.subarray(3)])
        };
    }

    teardown(() => {
        mock.restoreAll();
        requestedScopes.length = 0;
    });

    for (const isFunctionApp of [false, true]) {
        test(`preserves binary and text bytes/ETags through ${isFunctionApp ? 'ARM' : 'Kudu'} streaming`, async () => {
            const context = await createTestActionContext();
            const site = createSite(isFunctionApp);
            const url = isFunctionApp ? `${site.id}/hostruntime/admin/vfs/home/favicon.ico/?api-version=2022-03-01` : `${site.kuduUrl}/api/vfs/site/wwwroot/favicon.ico`;
            let content = bytes;
            mock.method(ServiceClient.prototype, 'sendRequest', (request: PipelineRequest) => {
                assert.strictEqual(request.url, url);
                assert.strictEqual(request.method, 'GET');
                assert.deepStrictEqual(request.streamResponseStatusCodes, new Set([200]));
                return Promise.resolve(response(request, content));
            });
            const file = await getFileBytes(context, site, url);
            assert.deepStrictEqual(Buffer.from(file.data), bytes);
            assert.strictEqual(file.etag, '"file-etag"');
            content = Buffer.from('normal text \u00e9\n', 'utf8');
            assert.deepStrictEqual(Buffer.from((await getFileBytes(context, site, url)).data), content);
            content = Buffer.alloc(0);
            assert.strictEqual((await getFileBytes(context, site, url)).data.byteLength, 0);
            if (!isFunctionApp) {
                assert.deepStrictEqual(requestedScopes, Array(3).fill(['https://appservice.azure.com/.default']));
            }
        });
    }

    test('retains the existing text retrieval contract', async () => {
        const context = await createTestActionContext();
        mock.method(ServiceClient.prototype, 'sendRequest', (request: PipelineRequest) => {
            assert.strictEqual(request.streamResponseStatusCodes, undefined);
            return Promise.resolve({ request, status: 200, headers: createHttpHeaders({ etag: 'etag' }), bodyAsText: 'text\n' });
        });
        assert.deepStrictEqual(await getFile(context, createSite(), 'https://example.test/file'), { data: 'text\n', etag: 'etag' });
    });

    test('sends binary uploads without decoding, preserving ETags and byte views', async () => {
        const context = await createTestActionContext();
        const site = createSite();
        const view = bytes.subarray(2, 8);
        const arrayBuffer = Uint8Array.from(bytes).buffer;
        for (const data of [view, arrayBuffer, 'normal text\n']) {
            const send = mock.method(ServiceClient.prototype, 'sendRequest', (request: PipelineRequest) => {
                assert.strictEqual(request.method, 'PUT');
                assert.strictEqual(request.url, 'https://example.test/file');
                assert.strictEqual(request.headers.get('If-Match'), '"previous-etag"');
                assert.deepStrictEqual(request.body, data instanceof ArrayBuffer ? new Uint8Array(data) : data);
                return Promise.resolve({ request, status: 200, headers: createHttpHeaders({ etag: '"updated-etag"' }) });
            });
            try {
                assert.strictEqual(await putFile(context, site, data, 'https://example.test/file', '"previous-etag"'), '"updated-etag"');
            } finally {
                send.mock.restore();
            }
        }
    });

    test('does not open HTTP failures or missing streams as empty files', async () => {
        for (const status of [404, 200]) {
            const context: IActionContext = await createTestActionContext();
            const send = mock.method(ServiceClient.prototype, 'sendRequest', (request: PipelineRequest) => Promise.resolve({
                request, status, headers: createHttpHeaders(), bodyAsText: 'not file bytes'
            }));
            try {
                await assert.rejects(getFileBytes(context, createSite(), 'https://example.test/file'), error =>
                    status === 404 ? error instanceof RestError && error.statusCode === 404 : error instanceof Error && error.message.includes('readable stream'));
                assert.strictEqual(context.telemetry.maskEntireErrorMessage, true);
            } finally {
                send.mock.restore();
            }
        }
    });

    test('propagates and masks transport cancellation and stream failures', async () => {
        for (const error of [new UserCancelledError(), new Error('transport failed'), new Error('stream contains private file data')]) {
            const context: IActionContext = await createTestActionContext();
            const send = mock.method(ServiceClient.prototype, 'sendRequest', (request: PipelineRequest) => {
                if (!error.message.startsWith('stream')) {
                    return Promise.reject(error);
                }
                return Promise.resolve({ ...response(request), readableStreamBody: Readable.from((function* () {
                    yield bytes.subarray(0, 3);
                    throw error;
                })()) });
            });
            try {
                await assert.rejects(getFileBytes(context, createSite(), 'https://example.test/file'), actual => actual === error);
                assert.strictEqual(context.telemetry.maskEntireErrorMessage, true);
            } finally {
                send.mock.restore();
            }
        }
    });
});
