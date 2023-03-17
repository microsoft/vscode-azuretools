/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createTestActionContext } from '@microsoft/vscode-azext-dev';
import * as assert from 'assert';
import * as http from 'http';
import * as types from '../index';
import { sendRequestWithTimeout } from '../src/createAzureClient';
import { assertThrowsAsync } from './assertThrowsAsync';

type ResponseData = { status: number; contentType?: string; body?: string; } | ((response: http.ServerResponse) => void);

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
                response.writeHead(testResponse.status, headers);
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
        const response = await sendTestRequest({ status: 200 });
        assert.strictEqual(response.parsedBody, undefined);
    });

    test('200, text body, no content type', async () => {
        const response = await sendTestRequest({ status: 200, body: 'Hello World!' });
        assert.strictEqual(response.parsedBody, undefined);
    });

    test('200, json body, no content type', async () => {
        const response = await sendTestRequest({ status: 200, body: '{ "data": "Hello World!" }' });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        assert.strictEqual(response.parsedBody.data, 'Hello World!');
    });

    test('200, text body, text content type', async () => {
        const response = await sendTestRequest({ status: 200, body: 'cant parse this', contentType: 'text/plain' });
        assert.strictEqual(response.parsedBody, undefined);
    });

    test('200, text body, json content type', async () => {
        await assertThrowsAsync(async () => await sendTestRequest({ status: 200, body: 'cant parse this', contentType: 'application/json' }), /SyntaxError.*json/i);
    });

    test('200, json body, text content type', async () => {
        const response = await sendTestRequest({ status: 200, body: '{ "data": "Hello World!" }', contentType: 'text/plain' });
        assert.strictEqual(response.parsedBody, undefined);
    });

    test('200, json body, json content type', async () => {
        const response = await sendTestRequest({ status: 200, body: '{ "data": "Hello World!" }', contentType: 'application/json' });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        assert.strictEqual(response.parsedBody.data, 'Hello World!');
    });

    test('200, json body, no content type, with bom', async () => {
        const response = await sendTestRequest({ status: 200, body: `\ufeff{ "data": "Hello World!" }` });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        assert.strictEqual(response.parsedBody.data, 'Hello World!');
    });

    test('200, json body, json content type, with bom', async () => {
        const response = await sendTestRequest({ status: 200, body: `\ufeff{ "data": "Hello World!" }`, contentType: 'application/json' });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        assert.strictEqual(response.parsedBody.data, 'Hello World!');
    });

    test('400', async () => {
        await assertThrowsAsync(async () => await sendTestRequest({ status: 400 }), /400/);
    });

    test('400 with error message', async () => {
        await assertThrowsAsync(async () => await sendTestRequest({ status: 400, body: 'oops' }), /oops/);
    });

    test('400 with json error message', async () => {
        await assertThrowsAsync(async () => await sendTestRequest({ status: 400, body: '{ "message": "oops" }' }), (err: Error) => err.message.includes('oops') && !err.message.includes('message'));
    });

    test('ECONNRESET', async () => {
        await assertThrowsAsync(async () => await sendTestRequest(res => res.destroy()), /socket hang up/i);
    });

    // test('operationSpec with unexpected  error', async () => {
    //     testResponses = [{ status: 404, body: 'oops' }];

    //     const request = new WebResource(url);
    //     request.operationSpec = { httpMethod: "GET", responses: { 200: {}, default: {} }, serializer: new Serializer() };
    //     const client = await createGenericClient(await createTestActionContext(), undefined);
    //     await assertThrowsAsync(async () => await client.sendRequest(request), /oops/);
    // });

    // test('operationSpec with expected error', async () => {
    //     testResponses = [{ status: 404, body: 'oops' }];

    //     const request = new WebResource(url);
    //     request.operationSpec = { httpMethod: "GET", responses: { 200: {}, 404: {}, default: {} }, serializer: new Serializer() };
    //     const client = await createGenericClient(await createTestActionContext(), undefined);
    //     const response = await client.sendRequest(request);
    //     assert.strictEqual(response.parsedBody, undefined);
    // });
});
