/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
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
            assert(!pe.stack.includes('Error: \n'));
            assert(!pe.stack.startsWith('at '));
            assert(pe.stack.includes('parseError.test.ts:'));
            assert(!pe.stack.includes('extensions'), `Should have removed first path of path (extensions), stack is: ${pe.stack}`);
            assert(!pe.stack.includes('repos'), `Should have removed first path of path (repos), stack is: ${pe.stack}`);
            const username: string = os.userInfo().username;
            // The Mac build machine uses "runner" as the username, but the stack references the file "vscode/mocha/runner.js" so the following assert won't work in that case ¯\_(ツ)_/¯
            if (username.toLowerCase() !== 'runner') {
                assert(!pe.stack.includes(username), `Should have removed first path of path (username "${username}"), stack is: ${pe.stack}`);
            }
            const homedir: string = os.userInfo().homedir;
            assert(!pe.stack.includes(homedir), `Should have removed first path of path (homedir "${homedir}"), stack is: ${pe.stack}`);
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
        const err = {
            code: 400,
            body: {
                code: 'BadRequest',
                message: 'Message: {"Errors":["The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100."]}\r\nActivityId: c11a5bcd-bf76-43c0-b713-b28e423599c4, Request URI: /apps/4c8d65d7-216b-46b4-abb7-52c1a0c7123f/services/36df4f13-26ef-48cf-bc7b-9ab28c345ca3/partitions/68d75b64-4651-4c15-b2a5-fc5550bab323/replicas/131570875506839239p, RequestStats: , SDK: Microsoft.Azure.Documents.Common/1.19.121.4'
            },
            activityId: '12345678-bf76-43c0-b713-b28e423599c4'
        };
        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, 'BadRequest');
        assert.strictEqual(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Multiple errors in object body', () => {
        const err = {
            code: 400,
            body: {
                code: 300,
                message: 'Message: {"Errors":["The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.", "The offer should have a valid timestamp."]}\r\nActivityId: c11a5bcd-bf76-43c0-b713-b28e423599c4, Request URI: /apps/4c8d65d7-216b-46b4-abb7-52c1a0c7123f/services/36df4f13-26ef-48cf-bc7b-9ab28c345ca3/partitions/68d75b64-4651-4c15-b2a5-fc5550bab323/replicas/131570875506839239p, RequestStats: , SDK: Microsoft.Azure.Documents.Common/1.19.121.4'
            },
            activityId: '12345678-bf76-43c0-b713-b28e423599c4'
        };
        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, '300');
        assert.strictEqual(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Multiple errors in stringified body', () => {
        const err = {
            code: 400,
            body: JSON.stringify({
                code: 'BadRequest2',
                message: 'Message: {"Errors":["The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100." ,"The offer should have a valid timestamp."]}\r\nActivityId: c11a5bcd-bf76-43c0-b713-b28e423599c4, Request URI: /apps/4c8d65d7-216b-46b4-abb7-52c1a0c7123f/services/36df4f13-26ef-48cf-bc7b-9ab28c345ca3/partitions/68d75b64-4651-4c15-b2a5-fc5550bab323/replicas/131570875506839239p, RequestStats: , SDK: Microsoft.Azure.Documents.Common/1.19.121.4'
            }),
            activityId: '12345678-bf76-43c0-b713-b28e423599c4'
        };
        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, 'BadRequest2');
        assert.strictEqual(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Error in object response', () => {
        const err = {
            code: 400,
            response: JSON.stringify({
                code: 'BadRequest4',
                message: 'Message: {"Errors":["The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100." ,"The offer should have a valid timestamp."]}\r\nActivityId: c11a5bcd-bf76-43c0-b713-b28e423599c4, Request URI: /apps/4c8d65d7-216b-46b4-abb7-52c1a0c7123f/services/36df4f13-26ef-48cf-bc7b-9ab28c345ca3/partitions/68d75b64-4651-4c15-b2a5-fc5550bab323/replicas/131570875506839239p, RequestStats: , SDK: Microsoft.Azure.Documents.Common/1.19.121.4'
            }),
            activityId: '12345678-bf76-43c0-b713-b28e423599c4'
        };
        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, 'BadRequest4');
        assert.strictEqual(pe.message, 'The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100.');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Error in object response in string body', () => {
        const err = {
            code: 400,
            response: {
                body: JSON.stringify({
                    code: 'BadRequest5',
                    message: 'Message: {"Errors":["The offer should have valid throughput values between 400 and 1000000 inclusive in increments of 100." ,"The offer should have a valid timestamp."]}\r\nActivityId: c11a5bcd-bf76-43c0-b713-b28e423599c4, Request URI: /apps/4c8d65d7-216b-46b4-abb7-52c1a0c7123f/services/36df4f13-26ef-48cf-bc7b-9ab28c345ca3/partitions/68d75b64-4651-4c15-b2a5-fc5550bab323/replicas/131570875506839239p, RequestStats: , SDK: Microsoft.Azure.Documents.Common/1.19.121.4'
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
        const err = {
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
        const err = {
            key: 1,
            value: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
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
        const err = {
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
        const err = {
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
        const err = {
            body: '',
            statusCode: 401
        };
        const pe: IParsedError = parseError(err);

        assert.strictEqual(pe.errorType, '401');
        assert.strictEqual(pe.message, 'Failed with code "401".');
        assert.strictEqual(pe.isUserCancelledError, false);
    });

    test('Errors array in error property', () => {
        const err = {
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
                // eslint-disable-next-line @typescript-eslint/naming-convention
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
        assert.strictEqual(pe.message, 'Microsoft Azure Web App - Error 404');
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
        assert.strictEqual(pe2.message, '401 - Unauthorized: Access is denied due to invalid credentials.');
        assert.strictEqual(pe2.isUserCancelledError, false);

        const pe3: IParsedError = parseError('<html><body><p>Failure&nbsp;&amp; retry &#x2014; see <a href="https://example.com?a=1&amp;b=2">details</a>.</p><script>ignored()</script></body></html>');
        assert.strictEqual(pe3.message, 'The server returned an HTML error response.');

        for (const body of ['<a href="https://example.com">details</a>', '&copy; Contoso', '<table><tr><td>Unavailable</td></tr></table>', 'Visible<script>ignored()', 'Visible<style>.hidden { display: none; }']) {
            assert.strictEqual(parseError(`<html><body>${body}`).message, 'The server returned an HTML error response.');
        }
    });

    test('Docker Request Error', () => {
        const err = {
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
        const err1 = {
            statusCode: 409,
            message: `<?xml version="1.0" encoding="utf-8"?><Error><Code>ContainerBeingDeleted</Code><Message>The specified container is being deleted. Try operation later.
RequestId:35eae91c-a01e-0010-1b5c-ca2979000000
Time:2020-01-13T21:57:13.6831007Z</Message></Error>`
        };
        const pe1: IParsedError = parseError(err1);

        assert.strictEqual(pe1.errorType, '409');
        assert.strictEqual(pe1.message, 'The specified container is being deleted. Try operation later.');
        assert.strictEqual(pe1.isUserCancelledError, false);

        const err2 = {
            statusCode: 412,
            message: `<?xml version="1.0" encoding="utf-8"?><Error><Code>LeaseIdMissing</Code><Message>There is currently a lease on the blob and no lease ID was specified in the request.
RequestId:2392b993-901e-0018-625e-ca320a000000
Time:2020-01-13T22:08:56.4055648Z</Message></Error>`
        };
        const pe2: IParsedError = parseError(err2);

        assert.strictEqual(pe2.errorType, '412');
        assert.strictEqual(pe2.message, 'There is currently a lease on the blob and no lease ID was specified in the request.');
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

    suite('Code scanning regressions', () => {
        test('handles repeated deserialization fragments without a matching body', () => {
            const message = 'error deserializing response '.repeat(30);
            assert.strictEqual(parseError({ code: 'Outer', message, response: { body: 'inner' } }).message, message);
            assert.strictEqual(parseError({ code: 'Outer', message: `${message}body`, response: { body: 'inner' } }).message, 'inner');
        });

        test('does not match deserialization fragments across line endings', () => {
            for (const separator of ['\n', '\r', '\u2028', '\u2029']) {
                const message = `error deserializing${separator}response body`;
                assert.strictEqual(parseError({ code: 'Outer', message, response: { body: 'inner' } }).message, message);
            }
        });

        test('uses the first XML message rather than greedily combining elements', () => {
            assert.strictEqual(parseError('\u0130<Message>first</Message><Message>second</MESSAGE>').message, 'first');
            assert.strictEqual(parseError('<message>unclosed').message, 'The server returned an XML error response.');
        });

        test('handles repeated stack function characters', () => {
            const name = '!'.repeat(30);
            assert.strictEqual(parseError({ message: 'test', stack: `    at ${name} (/tmp/file.js:1:2)` }).stack, `${name} file.js:1:2`);
        });

        test('handles repeated filesystem markers and incomplete errors', () => {
            const repeated = '( (FileSystemError)'.repeat(30);
            assert.strictEqual(parseError(`${repeated}incomplete`).message, `${repeated}incomplete`);
            assert.strictEqual(parseError('( (FileSystemError)').message, '( (FileSystemError)');
            assert.strictEqual(parseError(repeated).message, repeated.slice(1, -1));
            const parsed = parseError(`${repeated})`);
            assert.strictEqual(parsed.message, repeated.slice(1));
            assert.strictEqual(parsed.errorType, 'string');
            assert.strictEqual(parseError('earlier\n(EntryNotFound (filesystemerror): missing)\n').message, 'EntryNotFound (filesystemerror): missing');
        });

        test('uses plain titles and XML messages without formatting documents', () => {
            assert.strictEqual(parseError('<HTML><head><TITLE>  Service\n unavailable &amp; retry &#33; </TITLE></head><body>private details</body></HTML>').message, 'Service unavailable & retry !');
            assert.strictEqual(parseError('<?xml version="1.0"?><Error><Message>Try again.\r\nRequestId: private</Message></Error>').message, 'Try again.');
            assert.strictEqual(parseError('<Error><Message>Missing &quot;name&quot; &lt;value&gt; &apos;x&apos;.</Message></Error>').message, 'Missing "name" <value> \'x\'.');
            assert.strictEqual(parseError('A plain error with <path> in it.').message, 'A plain error with <path> in it.');
        });

        test('uses generic summaries for missing, malformed or nested markup', () => {
            for (const document of ['<html><body>details</body></html>', '<!DOCTYPE html><body>details</body>', '<html><title>unclosed', '<html><title> </title>', '<html><title><b>private</b></title>']) {
                assert.strictEqual(parseError(document).message, 'The server returned an HTML error response.');
            }
            for (const document of ['<?xml version="1.0"?><Fault>details</Fault>', '<Error><Code>Unknown</Code></Error>', '<Message><Details>private</Details></Message>', '<Message> </Message>']) {
                assert.strictEqual(parseError(document).message, 'The server returned an XML error response.');
            }
            const html = parseError({ statusCode: 503, message: '<html>details</html>' });
            assert.strictEqual(html.errorType, '503');
            assert.strictEqual(html.message, 'The server returned an HTML error response (HTTP 503).');
            const xml = parseError({ statusCode: 409, message: '<Error>details</Error>' });
            assert.strictEqual(xml.errorType, '409');
            assert.strictEqual(xml.message, 'The server returned an XML error response (HTTP 409).');
        });

        test('bounds summaries and decodes entities only once', () => {
            const title = 'x'.repeat(301);
            assert.strictEqual(parseError(`<html><title>${title}</title>`).message, `${'x'.repeat(297)}...`);
            assert.strictEqual(parseError(`<Message>${'x'.repeat(300)}</Message>`).message, 'x'.repeat(300));
            assert.strictEqual(parseError('<html><title>&amp;lt; &#x1F680; &#1114112; &unknown;</title></html>').message, '&lt; \u{1F680} &#1114112; &unknown;');
            assert.strictEqual(parseError('<html><title>&constructor; &AMP;</title></html>').message, '&constructor; &');
            const unicodeTitle = `${'x'.repeat(296)}\u{1F680}more`;
            assert.strictEqual(parseError(`<html><title>${unicodeTitle}</title></html>`).message, `${'x'.repeat(296)}...`);
        });

        test('selects the first XML line after decoding entities once', () => {
            for (const separator of ['&#10;', '&#13;', '&#xA;', '&#xD;', '&#8232;', '&#8233;']) {
                assert.strictEqual(parseError(`<Message>Try again.${separator}RequestId: private</Message>`).message, 'Try again.');
            }
            assert.strictEqual(parseError('<Message>Try again.&amp;#10;RequestId: private</Message>').message, 'Try again.&#10;RequestId: private');
        });

        test('uses actual HTTP statuses independently of error codes', () => {
            for (const message of ['<html>details</html>', '<Error>details</Error>']) {
                const kind = message.startsWith('<html>') ? 'HTML' : 'XML';
                for (const status of [503, '503']) {
                    for (const error of [
                        { code: 'ServiceUnavailable', statusCode: status, message },
                        { code: 'ServiceUnavailable', response: { status, body: message } },
                        { value: { statusCode: status, error: { code: 'ServiceUnavailable', message } } },
                        { errors: [{ code: 'ServiceUnavailable', statusCode: status, message }] },
                        { message: JSON.stringify({ statusCode: status, error: { code: 'ServiceUnavailable', message } }) },
                        { message: JSON.stringify({ code: 'ServiceUnavailable', statusCode: status, message }) }
                    ]) {
                        const parsed = parseError(error);
                        assert.strictEqual(parsed.errorType, 'ServiceUnavailable');
                        assert.strictEqual(parsed.message, `The server returned an ${kind} error response (HTTP 503).`);
                    }
                }
                for (const statusCode of [undefined, 99, 600, '503junk']) {
                    assert.strictEqual(parseError({ code: 123, statusCode, message }).message, `The server returned an ${kind} error response.`);
                    assert.strictEqual(
                        parseError({ code: 'ServiceUnavailable', statusCode, response: { status: 503 }, message }).message,
                        `The server returned an ${kind} error response (HTTP 503).`
                    );
                }
            }
        });

        test('keeps delimiter extraction and stack path privacy', () => {
            for (const separator of ['\n', '\r', '\r\n', '\u2028', '\u2029']) {
                assert.strictEqual(parseError(`prefix${separator}(EntryNotFound (FileSystemError): missing)${separator}`).message, 'EntryNotFound (FileSystemError): missing');
            }
            assert.strictEqual(parseError('<Message>unclosed').message, 'The server returned an XML error response.');
            assert.strictEqual(parseError({ message: 'test', stack: 'at C:\\Users\\private\\file.js:1:2\nat async D:\\private\\other.ts:3:4' }).stack, 'file.js:1:2\nother.ts:3:4');
            assert.strictEqual(parseError({ message: 'test', stack: 'at fn (C:\\private\\file(name).js:1:2)' }).stack, 'fn name).js:1:2');
            assert.strictEqual(parseError({ code: 'Outer', message: 'ERROR x DESERIALIZING x RESPONSE x BODY', response: { body: 'inner' } }).message, 'inner');
        });

        test('handles repeated markup and error fragments', () => {
            for (const size of [1000, 10000]) {
                for (const tail of ['<!--'.repeat(size), '<a title="'.repeat(size), '<broken '.repeat(size)]) {
                    assert.strictEqual(parseError('<html><body>visible' + tail).message, 'The server returned an HTML error response.');
                }
                const message = 'error deserializing response '.repeat(size);
                assert.strictEqual(parseError({ code: 'Outer', message, response: { body: 'inner' } }).message, message);
                assert.strictEqual(parseError({ code: 'Outer', message: message + 'body', response: { body: 'inner' } }).message, 'inner');
                const xml = '<message>a'.repeat(size);
                assert.strictEqual(parseError(xml).message, 'The server returned an XML error response.');
                assert.strictEqual(parseError(xml + '</message>').message, 'The server returned an XML error response.');
                assert.strictEqual(parseError('<html><title>' + 'x'.repeat(size) + '</title></html>').message, 'x'.repeat(297) + '...');
                const filesystem = '( (FileSystemError)'.repeat(size);
                assert.strictEqual(parseError(filesystem + 'incomplete').message, filesystem + 'incomplete');
                const name = '!'.repeat(size);
                assert.strictEqual(parseError({ message: 'test', stack: 'at ' + name + ' (C:\\private\\file.js:1:2)' }).stack, name + ' file.js:1:2');
            }
        });
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
