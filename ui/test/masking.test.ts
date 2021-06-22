/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as types from '../index';
import { addExtensionValueToMask, addValuesToMaskFromAzureId, callWithMaskHandling, maskUserInfo } from '../src/masking';
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
            }, (err) => {
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
            }, (err) => {
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
            }, (err) => {
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
            assert.strictEqual(maskUserInfo('user@microsoft.com', []), '---');
        });

        test('Multiple emails', async () => {
            assert.strictEqual(maskUserInfo('user@microsoft.com user2@microsoft.com us---Er@mic.rosoft.com', []), '--- --- ---');
        });
    });
});

function validateError(err: unknown, value: string): boolean {
    return !JSON.stringify(parseError(err)).includes(value) &&
        !JSON.stringify(parseError(err)).includes(encodeURIComponent(value));
}
