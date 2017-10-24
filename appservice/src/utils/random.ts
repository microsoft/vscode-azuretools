/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TEMPORARILY DISABLE
// tslint:disable:export-name
// tslint:disable:typedef

// tslint:disable:newline-before-return

import * as crypto from "crypto";

export namespace randomUtils {

    export function getRandomHexString(length: number): string {
        const buffer = crypto.randomBytes(Math.ceil(length / 2));
        return buffer.toString('hex').slice(0, length);
    }

}
