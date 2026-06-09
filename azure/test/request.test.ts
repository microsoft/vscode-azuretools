/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createPipelineRequest } from '@azure/core-rest-pipeline';
import { createTestActionContext } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import * as http from 'http';
import * as types from '../index';
import { createGenericClient, sendRequestWithTimeout } from '../src/createAzureClient';
import { assertThrowsAsync } from './assertThrowsAsync';

type ResponseData = { statusCode: number; contentType?: string; body?: string; } | ((response: http.ServerResponse) => void);

suite('request', () => {
    let url: string;
    let server: http.Server;
    let testResponses: ResponseData[] = [];

    async function sendTestRequest(...responses: ResponseData[]): Promise<types.AzExtPipelineResponse> {
        testResponses = responses;
        return await sendRequestWithTimeout(await createTestActionContext(), { method: 'GET', url, allowInsecureConnection: true }, 2000, undefined);
    }

    suiteSetup(() => {
        server = http.createServer((_req, response) => {
            const testResponse = testResponses.pop();
            if (!testResponse) {
                throw new Error('Unexpected request');
            } else if (typeof testResponse === 'function') {
                testResponse(response);
            } else {
                const headers: http.OutgoingHttpHeaders = {};
                if (testResponse.contentType) {
                    headers["Content-Type"] = testResponse.contentType;
                }
                response.writeHead(testResponse.statusCode, headers);
                response.end(testResponse.body);
            }
        });
        server.listen();
        const address = server.address();
        if (address && typeof address === 'object') {
            url = `http://127.0.0.1:${address.port}`;
        } else {
            throw new Error('Invalid address');
        }
    });

    suiteTeardown(() => {
        server.close();
    });

    test('200', async () => {
        const response = await sendTestRequest({ statusCode: 200 });
        assert.strictEqual(response.parsedBody, undefined);
    });

    test('200, text body, no content type', async () => {
        const response = await sendTestRequest({ statusCode: 200, body: 'Hello World!' });
        assert.strictEqual(response.parsedBody, undefined);
    });

    test('200, json body, no content type', async () => {
        const response = await sendTestRequest({ statusCode: 200, body: '{ "data": "Hello World!" }' });
        assert.strictEqual(response.parsedBody.data, 'Hello World!');
    });

    test('200, text body, text content type', async () => {
        const response = await sendTestRequest({ statusCode: 200, body: 'cant parse this', contentType: 'text/plain' });
        assert.strictEqual(response.parsedBody, undefined);
    });

    test('200, text body, json content type', async () => {
        await assertThrowsAsync(async () => await sendTestRequest({ statusCode: 200, body: 'cant parse this', contentType: 'application/json' }), /SyntaxError.*json/i);
    });

    test('200, json body, text content type', async () => {
        const response = await sendTestRequest({ statusCode: 200, body: '{ "data": "Hello World!" }', contentType: 'text/plain' });
        assert.strictEqual(response.parsedBody, undefined);
    });

    test('200, json body, json content type', async () => {
        const response = await sendTestRequest({ statusCode: 200, body: '{ "data": "Hello World!" }', contentType: 'application/json' });
        assert.strictEqual(response.parsedBody.data, 'Hello World!');
    });

    test('200, json body, no content type, with bom', async () => {
        const response = await sendTestRequest({ statusCode: 200, body: `\ufeff{ "data": "Hello World!" }` });
        assert.strictEqual(response.parsedBody.data, 'Hello World!');
    });

    test('200, json body, json content type, with bom', async () => {
        const response = await sendTestRequest({ statusCode: 200, body: `\ufeff{ "data": "Hello World!" }`, contentType: 'application/json' });
        assert.strictEqual(response.parsedBody.data, 'Hello World!');
    });

    test('400', async () => {
        await assertThrowsAsync(async () => await sendTestRequest({ statusCode: 400 }), /400/);
    });

    test('400 with error message', async () => {
        await assertThrowsAsync(async () => await sendTestRequest({ statusCode: 400, body: 'oops' }), /oops/);
    });

    test('400 with json error message', async () => {
        await assertThrowsAsync(async () => await sendTestRequest({ statusCode: 400, body: '{ "message": "oops" }' }), (err: Error) => err.message.includes('oops') && !err.message.includes('message'));
    });

    test('ECONNRESET', async () => {
        await assertThrowsAsync(async () => await sendTestRequest(res => res.destroy()), /socket hang up/i);
    });
});

suite('request redirects', () => {
    // A second server on a different port is a different origin, so redirecting from `originUrl`
    // to `targetUrl` exercises the cross-origin redirect behavior changed in
    // `@azure/core-rest-pipeline@1.23.0` (cross-origin redirects are not followed unless callers
    // opt in via `redirectOptions: { allowCrossOriginRedirects: true }`).
    let originUrl: string;
    let targetUrl: string;
    let originServer: http.Server;
    let targetServer: http.Server;

    // These tests assert the library's default (production) redirect behavior. When the feed mirror
    // is configured (CI sets FEED_BASE_URL/FEED_PAT), `FeedMirrorPolicy` overrides the redirect
    // policy on every generic client, so clear those vars here to test the real default.
    let savedFeedBaseUrl: string | undefined;
    let savedFeedPat: string | undefined;

    async function listen(server: http.Server): Promise<{ port: number }> {
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        if (address && typeof address === 'object') {
            return address;
        }
        throw new Error('Invalid address');
    }

    async function close(server: http.Server): Promise<void> {
        await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }

    suiteSetup(async () => {
        savedFeedBaseUrl = process.env.FEED_BASE_URL;
        savedFeedPat = process.env.FEED_PAT;
        delete process.env.FEED_BASE_URL;
        delete process.env.FEED_PAT;

        targetServer = http.createServer((_req, response) => {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end('{ "data": "redirected" }');
        });
        const targetAddress = await listen(targetServer);
        targetUrl = `http://127.0.0.1:${targetAddress.port}/landing`;

        originServer = http.createServer((_req, response) => {
            response.writeHead(302, { Location: targetUrl });
            response.end();
        });
        const originAddress = await listen(originServer);
        originUrl = `http://127.0.0.1:${originAddress.port}`;
    });

    suiteTeardown(async () => {
        if (savedFeedBaseUrl !== undefined) {
            process.env.FEED_BASE_URL = savedFeedBaseUrl;
        }
        if (savedFeedPat !== undefined) {
            process.env.FEED_PAT = savedFeedPat;
        }
        await close(originServer);
        await close(targetServer);
    });

    test('does not follow cross-origin redirect by default', async () => {
        const client = await createGenericClient(await createTestActionContext(), undefined);
        const response = await client.sendRequest(createPipelineRequest({
            method: 'GET',
            url: originUrl,
            allowInsecureConnection: true,
        })) as types.AzExtPipelineResponse;
        assert.strictEqual(response.status, 302);
    });

    test('follows cross-origin redirect when opted in via redirectOptions', async () => {
        const client = await createGenericClient(await createTestActionContext(), undefined, {
            redirectOptions: { allowCrossOriginRedirects: true },
        });
        const response = await client.sendRequest(createPipelineRequest({
            method: 'GET',
            url: originUrl,
            allowInsecureConnection: true,
        })) as types.AzExtPipelineResponse;
        assert.strictEqual(response.status, 200);
        assert.strictEqual(JSON.parse(response.bodyAsText!).data, 'redirected');
    });
});
