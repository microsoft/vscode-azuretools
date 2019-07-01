/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from "crypto";

export namespace randomUtils {
    export function getPseudononymousStringHash(s: string, encoding: crypto.HexBase64Latin1Encoding = 'base64'): string {
        return crypto.createHash('sha256').update(s).digest(encoding);
    }
}
