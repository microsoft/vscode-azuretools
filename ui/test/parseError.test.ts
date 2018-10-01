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
        assert.strictEqual(pe.errorType, 'Error');
        assert.strictEqual(pe.message, 'test');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Specific Error', () => {
        const pe: IParsedError = parseError(new ReferenceError('test'));
        assert.strictEqual(pe.errorType, 'ReferenceError');
        assert.strictEqual(pe.message, 'test');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('UserCancelledError', () => {
        const pe: IParsedError = parseError(new UserCancelledError());
        assert.strictEqual(pe.errorType, 'UserCancelledError');
        assert.strictEqual(pe.message, 'Operation cancelled.');
        assert.strictEqual(pe.isUserCancelledError, true);
    });

    test('Azure Error', () => {
        const pe: IParsedError = parseError(new Error('{ "Code": "Conflict", "Message": "test" }'));
        assert.strictEqual(pe.errorType, 'Conflict');
        assert.strictEqual(pe.message, 'test');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('String', () => {
        const pe: IParsedError = parseError('test');
        assert.strictEqual(pe.errorType, 'string');
        assert.strictEqual(pe.message, 'test');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Empty String', () => {
        const pe: IParsedError = parseError('   ');
        assert.strictEqual(pe.errorType, 'string');
        assert.strictEqual(pe.message, 'Unknown Error');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Object', () => {
        const pe: IParsedError = parseError({ myfield: 1 });
        assert.strictEqual(pe.errorType, 'object');
        assert.strictEqual(pe.message, '{"myfield":1}');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Object with errorCode', () => {
        const pe: IParsedError = parseError({ errorCode: 1 });
        assert.strictEqual(pe.errorType, '1');
        assert.strictEqual(pe.message, 'Failed with code "1".');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Object with errorCode and message', () => {
        const pe: IParsedError = parseError({ message: JSON.stringify({ message: 'hi', Code: 432 }) });
        assert.strictEqual(pe.errorType, '432');
        assert.strictEqual(pe.message, 'hi');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Custom Object', () => {
        class MyObject {
            public readonly msg: string;
            constructor(msg: string) { this.msg = msg; }
        }

        const pe: IParsedError = parseError(new MyObject('test'));
        assert.strictEqual(pe.errorType, 'MyObject');
        assert.strictEqual(pe.message, '{"msg":"test"}');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Null', () => {
        const pe: IParsedError = parseError(null);
        assert.strictEqual(pe.errorType, 'object');
        assert.strictEqual(pe.message, 'Unknown Error');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Array', () => {
        const pe: IParsedError = parseError([1, 2]);
        assert.strictEqual(pe.errorType, 'Array');
        assert.strictEqual(pe.message, '[1,2]');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Number', () => {
        const pe: IParsedError = parseError(3);
        assert.strictEqual(pe.errorType, 'number');
        assert.strictEqual(pe.message, '3');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Boolean', () => {
        const pe: IParsedError = parseError(false);
        assert.strictEqual(pe.errorType, 'boolean');
        assert.strictEqual(pe.message, 'false');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Undefined', () => {
        const pe: IParsedError = parseError(undefined);
        assert.strictEqual(pe.errorType, 'undefined');
        assert.strictEqual(pe.message, 'Unknown Error');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Zero', () => {
        const pe: IParsedError = parseError(0);
        assert.strictEqual(pe.errorType, 'number');
        assert.strictEqual(pe.message, '0');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Empty', () => {
        const pe: IParsedError = parseError('');
        assert.strictEqual(pe.errorType, 'string');
        assert.strictEqual(pe.message, 'Unknown Error');
        assert.strictEqual(pe.isUserCancelledError, false);
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

        assert.strictEqual(pe.errorType, 'BadRequest');
        assert.strictEqual(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.strictEqual(pe.isUserCancelledError, false);
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

        assert.strictEqual(pe.errorType, '300');
        assert.strictEqual(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.strictEqual(pe.isUserCancelledError, false);
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

        assert.strictEqual(pe.errorType, 'BadRequest2');
        assert.strictEqual(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.strictEqual(pe.isUserCancelledError, false);
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

        assert.strictEqual(pe.errorType, 'BadRequest4');
        assert.strictEqual(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.strictEqual(pe.isUserCancelledError, false);
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

        assert.strictEqual(pe.errorType, 'BadRequest5');
        assert.strictEqual(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.strictEqual(pe.isUserCancelledError, false);
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

        assert.strictEqual(pe.errorType, '111AuthorizationFailed');
        assert.strictEqual(pe.message, '111The client with object id does not have authorization to perform action Microsoft.Web/serverfarms/read over scope.');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Error with internal "error" property inside message', () => {
        const err: Error = new Error('{"error":{"code":"NoRegisteredProviderFound","message":"No registered resource provider found for location..."}}');
        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, 'NoRegisteredProviderFound');
        assert.strictEqual(pe.message, 'No registered resource provider found for location...');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Error with internal "error" property inside message that has been serialized twice', () => {
        const err: Error = new Error('"{\\"error\\":{\\"code\\":\\"NoRegisteredProviderFound\\",\\"message\\":\\"No registered resource provider found for location...\\"}}"');
        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, 'NoRegisteredProviderFound');
        assert.strictEqual(pe.message, 'No registered resource provider found for location...');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Error with nested value', () => {
        // This nested value structure is likely from an ErrorPromise in winjs
        // Per the docs, ErrorPromise "Wraps a non-promise error value in a promise. You can use this function if you need to pass an error to a function that requires a promise."
        // https://github.com/Microsoft/vscode/blob/master/src/vs/base/common/winjs.base.js
        const err: {} = {
            key: 1,
            value: {
                _value: {
                    response: {
                        statusCode: 404,
                        body: JSON.stringify({ Code: 'NotFound', Message: 'Cannot find Subscription with name test.', Target: null, Details: [{ Message: 'Cannot find Subscription with name test.' }, { Code: 'NotFound' }, { ErrorEntity: { ExtendedCode: '51004', MessageTemplate: 'Cannot find {0} with name {1}.', Parameters: ['Subscription', 'test'], Code: 'NotFound', Message: 'Cannot find Subscription with name test.' } }], Innererror: null })
                    },
                    statusCode: 404
                }
            }
        };
        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, 'NotFound');
        assert.strictEqual(pe.message, 'Cannot find Subscription with name test.');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Error when deserializing responseBody', () => {
        const err: {} = {
            message: 'Error "Unexpected token T in JSON at position 0" occurred in deserializing the responseBody - "The service is unavailable." for the default response.',
            response: {
                body: 'The service is unavailable.',
                statusCode: 503
            }
        };
        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, '503');
        assert.strictEqual(pe.message, 'The service is unavailable.');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Error with only a statusCode', () => {
        const err: {} = {
            body: '',
            statusCode: 401
        };
        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, '401');
        assert.strictEqual(pe.message, 'Failed with code "401".');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Errors array in error property', () => {
        const err: {} = {
            name: 'StatusCodeError',
            statusCode: 403,
            message: '403 - {\'errors\':[{\'code\':\'DENIED\',\'message\':\'access forbidden\'}],\'http_status\':403}',
            error: {
                errors: [
                    {
                        code: 'DENIED',
                        message: 'access forbidden'
                    }
                ],
                http_status: 403
            }
        };

        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, 'DENIED');
        assert.strictEqual(pe.message, 'access forbidden');
        assert.strictEqual(pe.isUserCancelledError, false);
    });
});
