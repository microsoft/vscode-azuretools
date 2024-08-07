/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { crypto } from '../node/crypto';

/* eslint-disable */
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
        if (length <= 0) {
            throw new Error(`Length must be strictly positive`);
        }

        const array = new Uint8Array(Math.ceil(length / 2)); // Each byte is represented by 2 hex characters
        crypto.getRandomValues(array);
        return Buffer.from(array).toString('hex').slice(0, length);
    }

    export function getRandomInteger(minimumInclusive: number, maximumExclusive: number): number {
        if (maximumExclusive <= minimumInclusive) {
            throw new Error(`Maximum must be strictly greater than minimum`);
        }

        return Math.floor(Math.random() * (maximumExclusive - minimumInclusive)) + minimumInclusive;
    }
}
