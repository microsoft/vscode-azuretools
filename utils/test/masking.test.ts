/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as types from '../index';
import { addExtensionValueToMask, addValuesToMaskFromAzureId, callWithMaskHandling, maskUserInfo, resetUsernameMask } from '../src/masking';
import { parseError } from '../src/parseError';
import { randomUtils } from '../src/utils/randomUtils';
import { assertThrowsAsync } from './assertThrowsAsync';

suite("masking", () => {
    const credentials: string = 'scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda';
    const credentialsSpecialChars: string = 'sc()HQ*E+RrAlXSm[CeN1$$$rhDz^^HWeDz2X[t5R343HgCN.xS0x]swc|A2CÑwf¬da';
    const credentialsWithReservedChars: string = '$scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda';
    suite("callWithMaskHandling", () => {
        test("Value masked (single occurance) with thrown error", async () => {

            const errorMessage: string = `To https://naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git
            ! [rejected]        HEAD -> master (fetch first)
           error: failed to push some refs to 'https://$naturins-22-error-03:scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda@naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git'
           hint: Updates were rejected because the remote contains work that you do
           hint: not have locally. This is usually caused by another repository pushing
           hint: to the same ref. You may want to first integrate the remote changes
           hint: (e.g., 'git pull ...') before pushing again.
           hint: See the 'Note about fast-forwards' in 'git push --help' for details.`;

            await assertThrowsAsync(async (): Promise<void> => {
                await callWithMaskHandling(async () => {
                    throw new Error(errorMessage);
                }, credentials);
            }, (err: unknown) => {
                return validateError(err, credentials);
            }, 'Credentials were not properly masked from error string');
        });

        test("Value masked (multiple occurance) with thrown error", async () => {

            const errorMessage: string = `"To https://naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git
            ! [rejected]        HEAD -> master (fetch first)
           error: failed to push some refs to 'https://$naturins-22-error-03:scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda@naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git'
           hint: Updates were rejected because the remote contains work that you do
           hint: not have locally. This is usually caused by another repository pushing
           hint: to the same ref. You may want to first integrate the remote changes
           hint: (e.g., 'git pull ...') before pushing again.
           hint: See the 'Note about fast-forwards' in 'git push --help' for details."
           https://$naturins-22-error-03:scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda@naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git
           scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda`;

            await assertThrowsAsync(async (): Promise<void> => {
                await callWithMaskHandling(async () => {
                    throw new Error(errorMessage);
                }, credentials);
            }, (err: unknown) => {
                return validateError(err, credentials);
            }, 'Credentials were not properly masked from error string');
        });

        test("Value masked (with special characters) with thrown error", async () => {

            const errorMessage: string = `To https://naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git
            ! [rejected]        HEAD -> master (fetch first)
           error: failed to push some refs to 'https://$naturins-22-error-03:sc()HQ*E+RrAlXSm[CeN1$$$rhDz^^HWeDz2X[t5R343HgCN.xS0x]swc|A2CÑwf¬da@naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git'
           hint: Updates were rejected because the remote contains work that you do
           hint: not have locally. This is usually caused by another repository pushing
           hint: to the same ref. You may want to first integrate the remote changes
           hint: (e.g., 'git pull ...') before pushing again.
           hint: See the 'Note about fast-forwards' in 'git push --help' for details.`;

            await assertThrowsAsync(async (): Promise<void> => {
                await callWithMaskHandling(async () => {
                    throw errorMessage;
                }, credentialsSpecialChars);
            }, (err: unknown) => {
                return validateError(err, credentialsSpecialChars);
            }, 'Credentials were not properly masked from error string');
        });

        test("Value masked (empty string) with thrown error", async () => {
            const errorMessage: string = "'ssh-keygen' is not recognized as an internal or external command";

            await assertThrowsAsync(async (): Promise<void> => {
                await callWithMaskHandling(async () => {
                    throw errorMessage;
                }, '');
            }, (err: Error) => {
                return err.message === errorMessage;
            }, 'Credentials were not properly masked from error string');
        });

        test("Value masked (encoded string) with thrown error", async () => {
            const errorMessage: string = `To https://naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git
            ! [rejected]        HEAD -> master (fetch first)
           error: failed to push some refs to 'https://$naturins-22-error-03:%24scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda@naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git'
           hint: Updates were rejected because the remote contains work that you do
           hint: not have locally. This is usually caused by another repository pushing
           hint: to the same ref. You may want to first integrate the remote changes
           hint: (e.g., 'git pull ...') before pushing again.
           hint: See the 'Note about fast-forwards' in 'git push --help' for details.`;

            await assertThrowsAsync(async (): Promise<void> => {
                await callWithMaskHandling(async () => {
                    throw errorMessage;
                }, credentialsWithReservedChars);
            }, (err: Error) => {
                return validateError(err, credentialsWithReservedChars);
            }, 'Credentials were not properly masked from error string');
        });
    });

    suite("maskUserInfo", () => {
        test('generic text should not be masked', async () => {
            const loremIpsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
            assert.strictEqual(maskUserInfo(loremIpsum, []), loremIpsum);
        });

        test('Action value', async () => {
            assert.strictEqual(maskUserInfo('test1', ['test1']), '---');
        });

        test('Extension value', async () => {
            const extensionValue = randomUtils.getRandomHexString();
            addExtensionValueToMask(extensionValue);
            assert.strictEqual(maskUserInfo(extensionValue, []), '---');
        });

        test('Multiple action and extension values', async () => {
            const extensionValue1 = randomUtils.getRandomHexString();
            const extensionValue2 = randomUtils.getRandomHexString();
            addExtensionValueToMask(extensionValue1);
            addExtensionValueToMask(extensionValue2);
            assert.strictEqual(maskUserInfo(`${extensionValue1} ${extensionValue2} action1 action2`, ['action1', 'action2']), '--- --- --- ---');
        });

        test('One value is substring of another', async () => {
            assert.strictEqual(maskUserInfo('firstNameLastName', ['firstName', 'firstNameLastName']), '---');
            assert.strictEqual(maskUserInfo('firstNameLastName', ['firstNameLastName', 'firstName']), '---'); // flip order
        });

        test('Values from azure id', async () => {
            const appId = `/subscriptions/${randomUtils.getRandomHexString()}/resourceGroups/${randomUtils.getRandomHexString()}/providers/Microsoft.Web/sites/${randomUtils.getRandomHexString()}`;
            const context = <types.IActionContext><any>{ valuesToMask: [] };
            addValuesToMaskFromAzureId(context, appId);
            assert.strictEqual(maskUserInfo(appId, context.valuesToMask), '/subscriptions/---/resourceGroups/---/providers/Microsoft.Web/sites/---');
        })

        test('Email', async () => {
            assert.strictEqual(maskUserInfo('user@microsoft.com user2@microsoft.com us---Er@mic.rosoft.com', []), 'redacted:email redacted:email redacted:email');
        });

        test('Username', async () => {
            resetUsernameMask();
            const getUsername = () => 'dave';
            assert.strictEqual(maskUserInfo('User dave cannot do that', [], false, getUsername), 'User redacted:username cannot do that');
            assert.strictEqual(maskUserInfo('User davecan do that', [], false, getUsername), 'User davecan do that');
            assert.strictEqual(maskUserInfo('Userdave can do that', [], false, getUsername), 'Userdave can do that');
            assert.strictEqual(maskUserInfo('User/dave cannot do that', [], false, getUsername), 'User/redacted:username cannot do that');
            assert.strictEqual(maskUserInfo('User dave/cannot do that', [], false, getUsername), 'User redacted:username/cannot do that');
            assert.strictEqual(maskUserInfo('Dave cannot do that', [], false, getUsername), 'redacted:username cannot do that');
            assert.strictEqual(maskUserInfo('Cannot do that, Dave', [], false, getUsername), 'Cannot do that, redacted:username');
        });

        test('Short Username', async () => {
            resetUsernameMask();
            const getUsername = () => 'dav';
            assert.strictEqual(maskUserInfo('User dav can do that', [], false, getUsername), 'User dav can do that');
            assert.strictEqual(maskUserInfo('Userdav can do that', [], false, getUsername), 'Userdav can do that');
            assert.strictEqual(maskUserInfo('Davuser can do that', [], false, getUsername), 'Davuser can do that');
        });

        test('Guid', async () => {
            assert.strictEqual(maskUserInfo('c35d6342-5917-46f8-953e-9d3faffd1c72 C35D6342-5917-46F8-953E-9D3FAFFD1C72 c35d6342591746f8953e9d3faffd1c72', []), 'redacted:id redacted:id redacted:id');
        });

        test('id with word breaks', async () => {
            assert.strictEqual(maskUserInfo('(c35d6342) "c35d6342" \'c35d6342\'', []), '(redacted:id) "redacted:id" \'redacted:id\'');
        });

        test('Ip address', async () => {
            assert.strictEqual(maskUserInfo('127.0.0.1 aaaa:0000:0000:0000:ffff:0000:0000:0001', []), 'redacted:id redacted:id');
        });

        test('Phone number', async () => {
            assert.strictEqual(maskUserInfo('000-0000 000-111-2222', []), 'redacted:id redacted:id');
        });

        test('Url', async () => {
            assert.strictEqual(maskUserInfo('https://microsoft.com http://microsoft.com mongodb://mongodb0.example.com:27017', []), 'redacted:url redacted:url redacted:url');
        });

        test('Url without scheme', async () => {
            assert.strictEqual(maskUserInfo('microsoft.com microsoft.org?queryParam=test1 microsoft.net', []), 'redacted:url redacted:url redacted:url');
        });

        test('Url masking exclusions', async () => {
            // ".NET" and "ASP.NET" with no scheme should not be masked, but something like "microsoft-asp.net" or "microsoftasp.net" *should* be masked.
            assert.strictEqual(maskUserInfo('microsoft.NET .NET ASP.NET microsoft-asp.net microsoftasp.net', []), 'redacted:url .NET ASP.NET redacted:url redacted:url');
            assert.strictEqual(maskUserInfo('http://microsoft.NET http://.NET http://ASP.NET http://microsoft-asp.net http://microsoftasp.net', []), 'redacted:url redacted:url redacted:url redacted:url redacted:url');
        });

        test('key', async () => {
            assert.strictEqual(maskUserInfo('sv=2012-02-12&st=2009-02-09&se=2009-02-10&sr=c&sp=r&si=YWJjZGVmZw%3d%3d&sig=dddddddddddddddddddddddddddddddddddddddddddddddd', []), 'redacted:key');
            assert.strictEqual(maskUserInfo('DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=dddddddddddddddddddddddddddddddddddddddddddddddd/dddddddd/dddddddd==;', []), 'redacted:key');
            assert.strictEqual(maskUserInfo('AccountEndpoint=accountname.documents.azure:443;AccountKey=accountkey==;', []), 'redacted:key');
            assert.strictEqual(maskUserInfo('microsoft.co?token=dddd', []), 'redacted:key');
            assert.strictEqual(maskUserInfo('--password ddddddd', []), 'redacted:key');
            assert.strictEqual(maskUserInfo('"POSTGRES_PASSWORD": "ddddddd"', []), 'redacted:key');
            assert.strictEqual(maskUserInfo('PGPASSWORD=ddddddd', []), 'redacted:key');
            assert.strictEqual(maskUserInfo('pwd: "ddddddd!@#$%^&*()_+"', []), 'redacted:key');
        });

        test('lessAggressive', async () => {
            const valueToMask = 'valueToMask';
            assert.strictEqual(maskUserInfo('https://microsoft.com c35d6342-5917-46f8-953e-9d3faffd1c72 hello@world accountkey=1234 valueToMask', [valueToMask], true /* lessAggressive */), 'redacted:url c35d6342-5917-46f8-953e-9d3faffd1c72 hello@world redacted:key ---');
        });

        // https://github.com/microsoft/vscode-azuretools/issues/967
        test('non-strings', async () => {
            assert.strictEqual(maskUserInfo(4, []), '4');
            assert.strictEqual(maskUserInfo(true, []), 'true');
            assert.strictEqual(maskUserInfo(undefined, []), 'undefined');
            assert.strictEqual(maskUserInfo(null, []), 'null');
            assert.strictEqual(maskUserInfo({}, []), '[object Object]');
            assert.strictEqual(maskUserInfo([], []), '');
        });
    });
});

function validateError(err: unknown, value: string): boolean {
    return !JSON.stringify(parseError(err)).includes(value) &&
        !JSON.stringify(parseError(err)).includes(encodeURIComponent(value));
}
