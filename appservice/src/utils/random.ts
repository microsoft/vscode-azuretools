/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from "crypto";

export function getRandomHexString(length: number): string {
    const buffer = crypto.randomBytes(Math.ceil(length / 2));
    let s = buffer.toString("hex").slice(0, length);
    return s;
}
