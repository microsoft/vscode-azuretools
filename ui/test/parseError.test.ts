/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IParsedError } from '../index';
import { UserCancelledError } from '../src/errors';
import { parseError } from '../src/parseError';

// tslint:disable-next-line:max-func-body-length
suite('Error Parsing Tests', () => {
    test('Generic Error', () => {
        const pe: IParsedError = parseError(new Error('test'));
        assert.equal(pe.errorType, 'Error');
        assert.equal(pe.message, 'test');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Specific Error', () => {
        const pe: IParsedError = parseError(new ReferenceError('test'));
        assert.equal(pe.errorType, 'ReferenceError');
        assert.equal(pe.message, 'test');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('UserCancelledError', () => {
        const pe: IParsedError = parseError(new UserCancelledError());
        assert.equal(pe.errorType, 'UserCancelledError');
        assert.equal(pe.message, 'Operation cancelled.');
        assert.equal(pe.isUserCancelledError, true);
    });

    test('Azure Error', () => {
        const pe: IParsedError = parseError(new Error('{ "Code": "Conflict", "Message": "test" }'));
        assert.equal(pe.errorType, 'Conflict');
        assert.equal(pe.message, 'test');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('String', () => {
        const pe: IParsedError = parseError('test');
        assert.equal(pe.errorType, 'string');
        assert.equal(pe.message, 'test');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Empty String', () => {
        const pe: IParsedError = parseError('   ');
        assert.equal(pe.errorType, 'string');
        assert.equal(pe.message, 'Unknown Error');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Object', () => {
        const pe: IParsedError = parseError({ myfield: 1 });
        assert.equal(pe.errorType, 'object');
        assert.equal(pe.message, '{"myfield":1}');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Object with errorCode', () => {
        const pe: IParsedError = parseError({ errorCode: 1 });
        assert.equal(pe.errorType, '1');
        assert.equal(pe.message, '{"errorCode":1}');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Object with errorCode and message', () => {
        const pe: IParsedError = parseError({ message: JSON.stringify({ message: 'hi', Code: 432 }) });
        assert.equal(pe.errorType, '432');
        assert.equal(pe.message, 'hi');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Custom Object', () => {
        class MyObject {
            public readonly msg: string;
            constructor(msg: string) { this.msg = msg; }
        }

        const pe: IParsedError = parseError(new MyObject('test'));
        assert.equal(pe.errorType, 'MyObject');
        assert.equal(pe.message, '{"msg":"test"}');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Null', () => {
        const pe: IParsedError = parseError(null);
        assert.equal(pe.errorType, 'object');
        assert.equal(pe.message, 'Unknown Error');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Array', () => {
        const pe: IParsedError = parseError([1, 2]);
        assert.equal(pe.errorType, 'Array');
        assert.equal(pe.message, '[1,2]');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Number', () => {
        const pe: IParsedError = parseError(3);
        assert.equal(pe.errorType, 'number');
        assert.equal(pe.message, '3');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Boolean', () => {
        const pe: IParsedError = parseError(false);
        assert.equal(pe.errorType, 'boolean');
        assert.equal(pe.message, 'false');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Undefined', () => {
        const pe: IParsedError = parseError(undefined);
        assert.equal(pe.errorType, 'undefined');
        assert.equal(pe.message, 'Unknown Error');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Zero', () => {
        const pe: IParsedError = parseError(0);
        assert.equal(pe.errorType, 'number');
        assert.equal(pe.message, '0');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Empty', () => {
        const pe: IParsedError = parseError('');
        assert.equal(pe.errorType, 'string');
        assert.equal(pe.message, 'Unknown Error');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Error in object body', () => {
        const err: {} = {
            code: 400,
            body: {
                code: 'BadRequest',
                message: 'Message: {\"Errors\":[\"The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.\"]}\r\nActivityId: c11a5bcd-bf76-43c0-b713-b28e423599c4, Request URI: /apps/4c8d65d7-216b-46b4-abb7-52c1a0c7123f/services/36df4f13-26ef-48cf-bc7b-9ab28c345ca3/partitions/68d75b64-4651-4c15-b2a5-fc5550bab323/replicas/131570875506839239p, RequestStats: , SDK: Microsoft.Azure.Documents.Common/1.19.121.4'
            },
            activityId: '12345678-bf76-43c0-b713-b28e423599c4'
        };
        const pe: IParsedError = parseError(err);

        assert.equal(pe.errorType, 'BadRequest');
        assert.equal(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Multiple errors in object body', () => {
        const err: {} = {
            code: 400,
            body: {
                code: 300,
                message: 'Message: {\"Errors\":[\"The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.\", \"The offer should have a valid timestamp.\"]}\r\nActivityId: c11a5bcd-bf76-43c0-b713-b28e423599c4, Request URI: /apps/4c8d65d7-216b-46b4-abb7-52c1a0c7123f/services/36df4f13-26ef-48cf-bc7b-9ab28c345ca3/partitions/68d75b64-4651-4c15-b2a5-fc5550bab323/replicas/131570875506839239p, RequestStats: , SDK: Microsoft.Azure.Documents.Common/1.19.121.4'
            },
            activityId: '12345678-bf76-43c0-b713-b28e423599c4'
        };
        const pe: IParsedError = parseError(err);

        assert.equal(pe.errorType, '300');
        assert.equal(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Multiple errors in stringified body', () => {
        const err: {} = {
            code: 400,
            body: JSON.stringify({
                code: 'BadRequest2',
                message: 'Message: {\"Errors\":[\"The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.\" ,\"The offer should have a valid timestamp.\"]}\r\nActivityId: c11a5bcd-bf76-43c0-b713-b28e423599c4, Request URI: /apps/4c8d65d7-216b-46b4-abb7-52c1a0c7123f/services/36df4f13-26ef-48cf-bc7b-9ab28c345ca3/partitions/68d75b64-4651-4c15-b2a5-fc5550bab323/replicas/131570875506839239p, RequestStats: , SDK: Microsoft.Azure.Documents.Common/1.19.121.4'
            }),
            activityId: '12345678-bf76-43c0-b713-b28e423599c4'
        };
        const pe: IParsedError = parseError(err);

        assert.equal(pe.errorType, 'BadRequest2');
        assert.equal(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Error in object response', () => {
        const err: {} = {
            code: 400,
            response: JSON.stringify({
                code: 'BadRequest4',
                message: 'Message: {\"Errors\":[\"The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.\" ,\"The offer should have a valid timestamp.\"]}\r\nActivityId: c11a5bcd-bf76-43c0-b713-b28e423599c4, Request URI: /apps/4c8d65d7-216b-46b4-abb7-52c1a0c7123f/services/36df4f13-26ef-48cf-bc7b-9ab28c345ca3/partitions/68d75b64-4651-4c15-b2a5-fc5550bab323/replicas/131570875506839239p, RequestStats: , SDK: Microsoft.Azure.Documents.Common/1.19.121.4'
            }),
            activityId: '12345678-bf76-43c0-b713-b28e423599c4'
        };
        const pe: IParsedError = parseError(err);

        assert.equal(pe.errorType, 'BadRequest4');
        assert.equal(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Error in object response in string body', () => {
        const err: {} = {
            code: 400,
            response: {
                body: JSON.stringify({
                    code: 'BadRequest5',
                    message: 'Message: {\"Errors\":[\"The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.\" ,\"The offer should have a valid timestamp.\"]}\r\nActivityId: c11a5bcd-bf76-43c0-b713-b28e423599c4, Request URI: /apps/4c8d65d7-216b-46b4-abb7-52c1a0c7123f/services/36df4f13-26ef-48cf-bc7b-9ab28c345ca3/partitions/68d75b64-4651-4c15-b2a5-fc5550bab323/replicas/131570875506839239p, RequestStats: , SDK: Microsoft.Azure.Documents.Common/1.19.121.4'
                })
            },
            activityId: '12345678-bf76-43c0-b713-b28e423599c4'
        };
        const pe: IParsedError = parseError(err);

        assert.equal(pe.errorType, 'BadRequest5');
        assert.equal(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.equal(pe.isUserCancelledError, false);
    });

    test('Error with multiple nested messages, including a "response.body" that fails to JSON parse', () => {
        const err: {} = {
            code: '111AuthorizationFailed',
            message: '111The client with object id does not have authorization to perform action Microsoft.Web/serverfarms/read over scope.',
            body: {
                code: '222AuthorizationFailed',
                message: '222The client with object id does not have authorization to perform action Microsoft.Web/serverfarms/read over scope.'
            },
            response: {
                body: '"{"error":{"code":"333AuthorizationFailed","message":"333The client with object id does not have authorization to perform action Microsoft.Web/serverfarms/read over scope.."}}"',
                statusCode: 403
            },
            statusCode: 403
        };

        const pe: IParsedError = parseError(err);

        assert.equal(pe.errorType, '111AuthorizationFailed');
        assert.equal(pe.message, '111The client with object id does not have authorization to perform action Microsoft.Web/serverfarms/read over scope.');
        assert.equal(pe.isUserCancelledError, false);
    });
});
