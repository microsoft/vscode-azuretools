/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { customAlphabet } from "nanoid";

export namespace randomUtils {
    export function getRandomHexString(length: number = 6): string {
        return customAlphabet('0123456789abcdef', length)();
    }
}
