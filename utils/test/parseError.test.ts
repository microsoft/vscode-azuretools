/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as os from 'os';
import { IParsedError } from '../index';
import { UserCancelledError } from '../src/errors';
import { parseError } from '../src/parseError';

suite('Error Parsing Tests', () => {
    suite('Call Stacks', () => {
        test('Not an error', () => {
            const pe: IParsedError = parseError('test');
            assert.strictEqual(pe.stack, undefined);
        });

        test('User-defined error', () => {
            let pe: IParsedError | undefined;
            try {
                throw new Error('hello');
            } catch (err) {
                pe = parseError(err);
            }
            assert(!!pe && !!pe.stack);
            /* eslint-disable @typescript-eslint/no-non-null-assertion */
            assert(!pe.stack!.includes('Error: \n'));
            assert(!pe.stack!.startsWith('at '));
            assert(pe.stack!.includes('parseError.test.js:'));
            assert(!pe.stack!.includes('extensions'), `Should have removed first path of path (extensions), stack is: ${pe.stack}`);
            assert(!pe.stack!.includes('repos'), `Should have removed first path of path (repos), stack is: ${pe.stack}`);
            const username: string = os.userInfo().username;
            // The Mac build machine uses "runner" as the username, but the stack references the file "vscode/mocha/runner.js" so the following assert won't work in that case ¯\_(ツ)_/¯
            if (username.toLowerCase() !== 'runner') {
                assert(!pe.stack!.includes(username), `Should have removed first path of path (username "${username}"), stack is: ${pe.stack}`);
            }
            const homedir: string = os.userInfo().homedir;
            assert(!pe.stack!.includes(homedir), `Should have removed first path of path (homedir "${homedir}"), stack is: ${pe.stack}`);
            /* eslint-enable @typescript-eslint/no-non-null-assertion */
        });

        test('Removes first part of paths: Windows', () => {
            const err: Error = new Error('hello');
            err.stack = `TypeError: Cannot read property 'findbyName' of undefined
                at UnrecognizedFunctionVisitor.visitFunction (C:\\Users\\MeMyselfAndI\\.vscode\\extensions\\msazurermtools.azurerm-vscode-tools-0.4.3-alpha\\dist\\extension.bundle.js:1:313309)
                at FunctionValue.accept (C:\\Users\\MeMyselfAndI\\.vscode\\extensions\\msazurermtools.azurerm-vscode-tools-0.4.3-alpha\\dist\\extension.bundle.js:1:308412)
                at Function.visit (C:\\Users\\MeMyselfAndI\\.vscode\\extensions\\msazurermtools.azurerm-vscode-tools-0.4.3-alpha\\dist\\extension.bundle.js:1:313489)
                at DeploymentTemplate.<anonymous> (C:\\Users\\MeMyselfAndI\\.vscode\\extensions\\msazurermtools.azurerm-vscode-tools-0.4.3-alpha\\dist\\extension.bundle.js:127:88385)
                at Generator.next (<anonymous>)
                at a (C:\\Users\\MeMyselfAndI\\.vscode\\extensions\\msazurermtools.azurerm-vscode-tools-0.4.3-alpha\\dist\\extension.bundle.js:127:86224)`;
            const pe: IParsedError = parseError(err);
            assert.strictEqual(pe.stack, `UnrecognizedFunctionVisitor.visitFunction extension.bundle.js:1:313309
FunctionValue.accept extension.bundle.js:1:308412
Function.visit extension.bundle.js:1:313489
DeploymentTemplate.<anonymous> extension.bundle.js:127:88385
a extension.bundle.js:127:86224`);
        });

        test('Removes first part of paths: Mac/Linux', () => {
            const err: Error = new Error('hello');
            err.stack = `StorageError: The specified share already exists.
            RequestId:36445445-801a-002c-2385-c94b79000000
            Time:2019-02-21T01:35:57.5335471Z
                at Function.StorageServiceClient._normalizeError (/Users/MeMyselfAndI/.vscode-insiders/extensions/ms-azuretools.vscode-azurestorage-0.6.0/node_modules/azure-storage/lib/common/services/storageserviceclient.js:1205:23)
                at FileService.StorageServiceClient._processResponse (/Users/MeMyselfAndI/.vscode-insiders/extensions/ms-azuretools.vscode-azurestorage-0.6.0/node_modules/azure-storage/lib/common/services/storageserviceclient.js:751:50)
                at Request.processResponseCallback [as _callback] (/Users/MeMyselfAndI/.vscode-insiders/extensions/ms-azuretools.vscode-azurestorage-0.6.0/node_modules/azure-storage/lib/common/services/storageserviceclient.js:319:37)
                at Request.init.self.callback (/Users/MeMyselfAndI/.vscode-insiders/extensions/ms-azuretools.vscode-azurestorage-0.6.0/node_modules/request/request.js:185:22)
                at Request.emit (events.js:182:13)
                at Request.<anonymous> (/Users/MeMyselfAndI/.vscode-insiders/extensions/ms-azuretools.vscode-azurestorage-0.6.0/node_modules/request/request.js:1161:10)
                at Request.emit (events.js:182:13)
                at IncomingMessage.<anonymous> (/Users/MeMyselfAndI/.vscode-insiders/extensions/ms-azuretools.vscode-azurestorage-0.6.0/node_modules/request/request.js:1083:12)
                at Object.onceWrapper (events.js:273:13)
                at IncomingMessage.emit (events.js:187:15)`;
            const pe: IParsedError = parseError(err);
            assert.strictEqual(pe.stack, `Function.StorageServiceClient._normalizeError azure-storage/storageserviceclient.js:1205:23
FileService.StorageServiceClient._processResponse azure-storage/storageserviceclient.js:751:50
Request.processResponseCallback [as _callback] azure-storage/storageserviceclient.js:319:37
Request.init.self.callback request/request.js:185:22
Request.emit events.js:182:13
Request.<anonymous> request/request.js:1161:10
Request.emit events.js:182:13
IncomingMessage.<anonymous> request/request.js:1083:12
Object.onceWrapper events.js:273:13
IncomingMessage.emit events.js:187:15`);
        });

        test('Source lines without function name', () => {
            const err: Error = new Error('hello');
            err.stack = `Error: API version "0.1" for extension id "ms-azuretools.azureextensionui" is no longer supported. Minimum version is "1.0.0".
            at Object.<anonymous> (/Users/YouYourselfAndYou/repos/vscode-azuretools/ui/src/createApiProvider.ts:62:19)
            at Object.callWithTelemetryAndErrorHandlingSync (/Users/YouYourselfAndYou/repos/vscode-azuretools/ui/src/callWithTelemetryAndErrorHandling.ts:41:28)
            at Generator.next (<anonymous>)
            at /Users/YouYourselfAndYou/repos/vscode-azuretools/ui/node_modules/vscode/node_modules/mocha/lib/runner.js:560:12
            at next (/Users/YouYourselfAndYou/repos/vscode-azuretools/ui/node_modules/vscode/node_modules/mocha/lib/runner.js:356:14)
            at /Users/YouYourselfAndYou/repos/vscode-azuretools/ui/node_modules/vscode/node_modules/mocha/lib/runner.js:366:7`;
            const pe: IParsedError = parseError(err);
            assert.strictEqual(pe.stack, `Object.<anonymous> createApiProvider.ts:62:19
Object.callWithTelemetryAndErrorHandlingSync callWithTelemetryAndErrorHandling.ts:41:28
vscode/mocha/runner.js:560:12
next vscode/mocha/runner.js:356:14
vscode/mocha/runner.js:366:7`);
        });

        test('Remove Users if necessary', () => {
            const err: Error = new Error('hello');
            err.stack = `at Context.test (/Users/vsts/agent/2.147.1/work/1/s/ui/test/parseError.test.ts:25:23)
                    at callFn (/Users/vsts/agent/2.147.1/work/1/s/ui/node_modules/vscode/node_modules/mocha/lib/runnable.js:354:21)
                    at module.exports../src/AzureRMTools.ts.__awaiter (/Users/vsts/repos/vscode-azurearmtools/dist/extension.bundle.js:160227:71)`;
            const pe: IParsedError = parseError(err);
            assert.strictEqual(pe.stack, `Context.test parseError.test.ts:25:23
callFn vscode/mocha/runnable.js:354:21
AzureRMTools.ts.__awaiter extension.bundle.js:160227:71`);
        });

        test('Weird stack', () => {
            const err: Error = new Error('hello');
            err.stack = `TypeError: Cannot read property 'errors' of null
                at Object.<anonymous> (/Users/anyone/repos/vscode-azurearmtools/dist/extension.bundle.js:160396:60)
                at Generator.next (<anonymous>)
                at module.exports../src/AzureRMTools.ts.__awaiter (/Users/anyone/repos/vscode-azurearmtools/dist/extension.bundle.js:160227:71)
                at new Promise (<anonymous>)
                at module.exports../src/AzureRMTools.ts.__awaiter (/Users/anyone/repos/vscode-azurearmtools/dist/extension.bundle.js:160223:12)
                at Object.<anonymous> (/Users/anyone/repos/vscode-azurearmtools/dist/extension.bundle.js:160394:20)
                at Object.<anonymous> (/Users/anyone/repos/vscode-azurearmtools/dist/extension.bundle.js:148668:51)
                at Generator.next (<anonymous>)
                at module.exports../node_modules/vscode-azureextensionui/out/src/callWithTelemetryAndErrorHandling.js.__awaiter (/Users/anyone/repos/vscode-azurearmtools/dist/extension.bundle.js:148618:71)
                at new Promise (<anonymous>)`;
            const pe: IParsedError = parseError(err);
            assert.strictEqual(pe.stack, `Object.<anonymous> extension.bundle.js:160396:60
AzureRMTools.ts.__awaiter extension.bundle.js:160227:71
AzureRMTools.ts.__awaiter extension.bundle.js:160223:12
Object.<anonymous> extension.bundle.js:160394:20
Object.<anonymous> extension.bundle.js:148668:51
callWithTelemetryAndErrorHandling.js.__awaiter vscode-azureextensionui/extension.bundle.js:148618:71`);
        });

    });

    test('Generic Error', () => {
        const pe: IParsedError = parseError(new Error('test'));
        assert.strictEqual(pe.errorType, 'Error');
        assert.strictEqual(pe.message, 'test');
        assert.strictEqual(pe.isUserCancelledError, false);
        assert.strictEqual(pe.stepName, undefined);
    });

    test('Specific Error', () => {
        const pe: IParsedError = parseError(new ReferenceError('test'));
        assert.strictEqual(pe.errorType, 'ReferenceError');
        assert.strictEqual(pe.message, 'test');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('UserCancelledError', () => {
        const pe: IParsedError = parseError(new UserCancelledError('step1'));
        assert.strictEqual(pe.errorType, 'UserCancelledError');
        assert.strictEqual(pe.message, 'Operation cancelled.');
        assert.strictEqual(pe.isUserCancelledError, true);
        assert.strictEqual(pe.stepName, 'step1');
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

    test('Azure StatusCodeError', () => {
        const err: {} = {
            name: "StatusCodeError",
            statusCode: 400,
            message: "400 - \"{\\\"error\\\":{\\\"code\\\":\\\"MissingApiVersionParameter\\\",\\\"message\\\":\\\"The api-version query parameter (?api-version=) is required for all requests.\\\"}}\"",
            error: "{\"error\":{\"code\":\"MissingApiVersionParameter\",\"message\":\"The api-version query parameter (?api-version=) is required for all requests.\"}}",
            response: {
                statusCode: 400,
                body: "{\"error\":{\"code\":\"MissingApiVersionParameter\",\"message\":\"The api-version query parameter (?api-version=) is required for all requests.\"}}"
            }
        };

        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, 'MissingApiVersionParameter');
        assert.strictEqual(pe.message, 'The api-version query parameter (?api-version=) is required for all requests.');
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

    test('HTML errors', () => {
        const err: string = `<!DOCTYPE html>
<html>
<head>
    <title>Microsoft Azure Web App - Error 404</title>
    <style type="text/css">
        html {
            height: 100%;
            width: 100%;
        }

        #feature {
            width: 960px;
            margin: 75px auto 0 auto;
            overflow: auto;
        }

        #content {
            font-family: "Segoe UI";
            font-weight: normal;
            font-size: 22px;
            color: #ffffff;
            float: left;
            margin-top: 68px;
            margin-left: 0px;
            vertical-align: middle;
        }

            #content h1 {
                font-family: "Segoe UI Light";
                color: #ffffff;
                font-weight: normal;
                font-size: 60px;
                line-height: 48pt;
                width: 800px;
            }

        a, a:visited, a:active, a:hover {
            color: #ffffff;
        }

        #content a.button {
            background: #0DBCF2;
            border: 1px solid #FFFFFF;
            color: #FFFFFF;
            display: inline-block;
            font-family: Segoe UI;
            font-size: 24px;
            line-height: 46px;
            margin-top: 10px;
            padding: 0 15px 3px;
            text-decoration: none;
        }

            #content a.button img {
                float: right;
                padding: 10px 0 0 15px;
            }

            #content a.button:hover {
                background: #1C75BC;
            }
    </style>
    <script type="text/javascript">
        function toggle_visibility(id) {
            var e = document.getElementById(id);
            if (e.style.display == 'block')
                e.style.display = 'none';
            else
                e.style.display = 'block';
        }
    </script>
</head>
<body bgcolor="#00abec">
    <div id="feature">
        <div id="content">
            <h1>404 Web Site not found.</h1>
            <p>You may be seeing this error due to one of the reasons listed below :</p>
            <ul>
                <li>Custom domain has not been configured inside Azure. See <a href="https://docs.microsoft.com/en-us/azure/app-service-web/app-service-web-tutorial-custom-domain">how to map an existing domain</a> to resolve this.</li>
                <li>Client cache is still pointing the domain to old IP address. Clear the cache by running the command <i>ipconfig/flushdns.</i></li>
            </ul>
            <p>Checkout <a href="https://blogs.msdn.microsoft.com/appserviceteam/2017/08/08/faq-app-service-domain-preview-and-custom-domains/">App Service Domain FAQ</a> for more questions.</p>
        </div>
     </div>
</body>
</html>`;
        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, 'string');
        assert.strictEqual(pe.message, `404 Web Site not found.

You may be seeing this error due to one of the reasons listed below :

 * Custom domain has not been configured inside Azure. See how to map an existing domain [https://docs.microsoft.com/en-us/azure/app-service-web/app-service-web-tutorial-custom-domain] to resolve this.
 * Client cache is still pointing the domain to old IP address. Clear the cache by running the command ipconfig/flushdns.

Checkout App Service Domain FAQ [https://blogs.msdn.microsoft.com/appserviceteam/2017/08/08/faq-app-service-domain-preview-and-custom-domains/] for more questions.`);
        assert.strictEqual(pe.isUserCancelledError, false);

        const err2: string = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"/>
<title>401 - Unauthorized: Access is denied due to invalid credentials.</title>
<style type="text/css">
<!--
body{margin:0;font-size:.7em;font-family:Verdana, Arial, Helvetica, sans-serif;background:#EEEEEE;}
fieldset{padding:0 15px 10px 15px;}
h1{font-size:2.4em;margin:0;color:#FFF;}
h2{font-size:1.7em;margin:0;color:#CC0000;}
h3{font-size:1.2em;margin:10px 0 0 0;color:#000000;}
#header{width:96%;margin:0 0 0 0;padding:6px 2% 6px 2%;font-family:"trebuchet MS", Verdana, sans-serif;color:#FFF;
background-color:#555555;}
#content{margin:0 0 0 2%;position:relative;}
.content-container{background:#FFF;width:96%;margin-top:8px;padding:10px;position:relative;}
-->
</style>
</head>
<body>
<div id="header"><h1>Server Error</h1></div>
<div id="content">
 <div class="content-container"><fieldset>
  <h2>401 - Unauthorized: Access is denied due to invalid credentials.</h2>
  <h3>You do not have permission to view this directory or page using the credentials that you supplied.</h3>
 </fieldset></div>
</div>
</body>
</html>`;
        const pe2: IParsedError = parseError(err2);

        assert.strictEqual(pe2.errorType, 'string');
        assert.strictEqual(pe2.message, `Server Error
401 - Unauthorized: Access is denied due to invalid credentials.
You do not have permission to view this directory or page using the credentials that you supplied.`);
        assert.strictEqual(pe2.isUserCancelledError, false);
    });

    test('Docker Request Error', () => {
        const err: {} = {
            name: "StatusCodeError",
            statusCode: 401,
            message: "401 - {\"detail\":\"Incorrect authentication credentials.\"}",
            error: {
                detail: "Incorrect authentication credentials."
            },
            options: {},
            response: {
                statusCode: 401,
                body: {
                    detail: "Incorrect authentication credentials."
                },
                headers: {},
                request: {}
            }
        };
        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, '401');
        assert.strictEqual(pe.message, 'Incorrect authentication credentials.');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('XML errors', () => {
        const err1: {} = {
            statusCode: 409,
            message: `<?xml version="1.0" encoding="utf-8"?><Error><Code>ContainerBeingDeleted</Code><Message>The specified container is being deleted. Try operation later.
RequestId:35eae91c-a01e-0010-1b5c-ca2979000000
Time:2020-01-13T21:57:13.6831007Z</Message></Error>`
        };
        const pe1: IParsedError = parseError(err1);

        assert.strictEqual(pe1.errorType, '409');
        assert.strictEqual(pe1.message, `The specified container is being deleted. Try operation later.
RequestId:35eae91c-a01e-0010-1b5c-ca2979000000
Time:2020-01-13T21:57:13.6831007Z`);
        assert.strictEqual(pe1.isUserCancelledError, false);

        const err2: {} = {
            statusCode: 412,
            message: `<?xml version="1.0" encoding="utf-8"?><Error><Code>LeaseIdMissing</Code><Message>There is currently a lease on the blob and no lease ID was specified in the request.
RequestId:2392b993-901e-0018-625e-ca320a000000
Time:2020-01-13T22:08:56.4055648Z</Message></Error>`
        };
        const pe2: IParsedError = parseError(err2);

        assert.strictEqual(pe2.errorType, '412');
        assert.strictEqual(pe2.message, `There is currently a lease on the blob and no lease ID was specified in the request.
RequestId:2392b993-901e-0018-625e-ca320a000000
Time:2020-01-13T22:08:56.4055648Z`);
        assert.strictEqual(pe2.isUserCancelledError, false);
    });

    test('FileSystemError', () => {
        const pe: IParsedError = parseError({
            name: 'Error',
            message: "cannot open azureDatabases:/testCol33-cosmos-collection.json?id%3D%2FcosmosDBAttachedAccounts%2F127.0.0.1%3A27017%2FtestDB%2FtestCol33. Detail: Unable to read file 'azureDatabases:/testCol33-cosmos-collection.json?id=/cosmosDBAttachedAccounts/127.0.0.1:27017/testDB/testCol33' (EntryNotFound (FileSystemError): azureDatabases:/testCol33-cosmos-collection.json?id=/cosmosDBAttachedAccounts/127.0.0.1:27017/testDB/testCol33)"
        });
        assert.strictEqual(pe.errorType, 'EntryNotFound');
        assert.strictEqual(pe.message, 'EntryNotFound (FileSystemError): azureDatabases:/testCol33-cosmos-collection.json?id=/cosmosDBAttachedAccounts/127.0.0.1:27017/testDB/testCol33');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Error with weird stack', () => {
        const pe: IParsedError = parseError({
            stack: {}
        });
        assert.strictEqual(pe.errorType, 'object');
        assert.strictEqual(pe.message, '{"stack":{}}');
        assert.strictEqual(pe.isUserCancelledError, false);
    });
});
