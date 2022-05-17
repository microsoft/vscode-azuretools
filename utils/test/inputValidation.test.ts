/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { validOnTimeoutOrException } from '../src/utils/inputValidation';

suite("inputValidation Tests", () => {
    suite("validOnTimeoutOrException", () => {
        test("executed", async () => {
            const value: string | undefined | null = await validOnTimeoutOrException(async () => {
                return await new Promise<string | undefined>((resolve, _reject) => {
                    setTimeout(() => { resolve("invalid input"); }, 1);
                });
            });

            assert.equal(value, "invalid input");
        });

        test("timed out", async () => {
            const value: string | undefined | null = await validOnTimeoutOrException(
                async () => {
                    return await new Promise<string | undefined>((resolve, _reject) => {
                        setTimeout(() => { resolve("invalid input"); }, 1000);
                    });
                },
                1
            );

            assert.equal(value, undefined);
        });

        test("exception", async () => {
            const value: string | undefined | null = await validOnTimeoutOrException(async () => {
                return await new Promise<string | undefined>((_resolve, reject) => {
                    setTimeout(() => { reject(new Error("Oh, boy")); }, 1);
                });
            });

            assert.equal(value, undefined);
        });
    });
});
