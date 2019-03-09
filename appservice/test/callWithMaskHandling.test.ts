/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { parseError } from 'vscode-azureextensionui';
import { callWithMaskHandling } from '../src/utils/callWithMaskHandling';
import { assertThrowsAsync } from './assertThrowsAsync';

suite("callWithMaskHandling Tests", () => {
    const credentials: string = 'scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda';
    suite("callWithMaskHandling", () => {
        test("Value masked (single occurance) with thrown error", async () => {

            // tslint:disable-next-line: no-multiline-string
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

            // tslint:disable-next-line: no-multiline-string
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

        test("Value masked (single occurance) with thrown error", async () => {

            // tslint:disable-next-line: no-multiline-string
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
                    throw errorMessage;
                }, credentials);
            }, (err) => {
                return validateError(err, credentials);
            }, 'Credentials were not properly masked from error string');
        });
    });
});

// tslint:disable-next-line: no-any
function validateError(err: any, value: string): boolean {
    return !JSON.stringify(parseError(err)).includes(value);
}
