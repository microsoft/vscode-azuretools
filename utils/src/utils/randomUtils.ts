/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { crypto } from '../node/crypto';

export namespace randomUtils {
    export async function getPseudononymousStringHash(s: string): Promise<string> {
        const buffer = Buffer.from(s);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(""); // convert bytes to hex string
        return hashHex;
    }

    export function getRandomHexString(length: number = 6): string {
        return crypto.randomUUID().slice(0, length);
    }

    export function getRandomInteger(minimumInclusive: number, maximumExclusive: number): number {
        if (maximumExclusive <= minimumInclusive) {
            throw new Error(`Maximum must be strictly greater than minimum`);
        }

        return Math.floor(Math.random() * (maximumExclusive - minimumInclusive)) + minimumInclusive;
    }
}
