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
// tslint:disable-next-line:export-name
export async function validOnTimeoutOrException(inputValidation: () => Promise<string | null | undefined>, timeoutMs?: number): Promise<string | null | undefined> {
    try {
        // tslint:disable-next-line:strict-boolean-expressions
        timeoutMs = timeoutMs || inputValidationTimeoutMs;
        return await valueOnTimeout(timeoutMs, undefined, inputValidation);
    } catch (error) {
        return undefined;
    }
}
