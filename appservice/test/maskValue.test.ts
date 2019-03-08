/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { maskValue } from '../src/utils/maskValue';

suite("maskValue Tests", () => {
    const credentials: string = 'scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda';
    suite("maskValue", () => {
        test("Value masked (single occurance)", async () => {

            // tslint:disable-next-line: no-multiline-string
            let errorMessage: string = `To https://naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git
            ! [rejected]        HEAD -> master (fetch first)
           error: failed to push some refs to 'https://$naturins-22-error-03:scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda@naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git'
           hint: Updates were rejected because the remote contains work that you do
           hint: not have locally. This is usually caused by another repository pushing
           hint: to the same ref. You may want to first integrate the remote changes
           hint: (e.g., 'git pull ...') before pushing again.
           hint: See the 'Note about fast-forwards' in 'git push --help' for details.`;

            errorMessage = maskValue(errorMessage, credentials);
            assert.equal(errorMessage.indexOf(credentials), -1, 'Credentials were not properly masked from error string');
        });

        test("Value masked (multiple occurance)", async () => {

            // tslint:disable-next-line: no-multiline-string
            let errorMessage: string = `"To https://naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git
            ! [rejected]        HEAD -> master (fetch first)
           error: failed to push some refs to 'https://$naturins-22-error-03:scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda@naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git'
           hint: Updates were rejected because the remote contains work that you do
           hint: not have locally. This is usually caused by another repository pushing
           hint: to the same ref. You may want to first integrate the remote changes
           hint: (e.g., 'git pull ...') before pushing again.
           hint: See the 'Note about fast-forwards' in 'git push --help' for details."
           https://$naturins-22-error-03:scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda@naturins-22-error-03.scm.azurewebsites.net:443/naturins-22-error-03.git
           scHQERrAlXSmlCeN1mrhDzsHWeDz2XZt5R343HgCNmxS0xlswcaA2Cowflda`;

            errorMessage = maskValue(errorMessage, credentials);
            assert.equal(errorMessage.indexOf(credentials), -1, 'Credentials were not properly masked from error string');
        });
    });
});
