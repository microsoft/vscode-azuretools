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

    // tslint:disable-next-line:max-func-body-length
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
        assert.strictEqual(pe.message, ` 404 Web Site not found.
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

    suite('Copy telemetry properties from error', () => {
        test('cancelStep', () => {
            const err: Error = new UserCancelledError('myCancelStep');
            const pe: IParsedError = parseError(err);
            assert.equal(pe.telemetryProperties && pe.telemetryProperties.cancelStep, 'myCancelStep');
        });

        test('none in UserCancelledError', () => {
            const err: Error = new UserCancelledError();
            const pe: IParsedError = parseError(err);
            assert.deepEqual(pe.telemetryProperties, {});
        });

        test('cancelStep: custom properties', () => {
            const err: UserCancelledError = new UserCancelledError();
            err.telemetryProperties.cancelStep = 'canceled';
            err.telemetryProperties.custom = 'custom';

            const pe: IParsedError = parseError(err);
            assert.equal(pe.telemetryProperties && pe.telemetryProperties.cancelStep, 'canceled');
            assert.equal(pe.telemetryProperties && pe.telemetryProperties.custom, 'custom');
        });
    });
});
