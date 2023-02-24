/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { valueOnTimeout } from "./timeout";

const inputValidationTimeoutMs: number = 2000;

/**
 * Intended to be used for VS Code validateInput to protect against long-running validations. If a time-out occurs or the action throws,
 * returns undefined (indicating a valid input). Use for optional validations.
 */
export async function validOnTimeoutOrException<T>(inputValidation: () => Promise<T>, timeoutMs?: number): Promise<T | undefined | null> {
    try {
        timeoutMs ||= inputValidationTimeoutMs;
        return await valueOnTimeout<T | undefined | null>(timeoutMs, undefined, inputValidation);
    } catch (error) {
        return undefined;
    }
}
