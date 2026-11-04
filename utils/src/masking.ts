/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { IActionContext, IParsedError } from "../index";
import { parseError } from "./parseError";

// eslint-disable-next-line @typescript-eslint/naming-convention
let _extValuesToMask: string[] | undefined;
function getExtValuesToMask(): string[] {
    _extValuesToMask ??= [];
    return _extValuesToMask;
}

export function addExtensionValueToMask(...values: (string | undefined)[]): void {
    const extValuesToMask: string[] = getExtValuesToMask();
    for (const v of values) {
        if (v && !extValuesToMask.includes(v)) {
            extValuesToMask.push(v);
        }
    }
}

/**
 * Example id: /subscriptions/00000000-0000-0000-0000-00000000/resourceGroups/rg1/providers/Microsoft.Web/sites/site1
 */
export function addValuesToMaskFromAzureId(context: IActionContext, id: string | undefined): void {
    const parts: string[] = (id || '').toLowerCase().split('/');
    if (parts[1] === 'subscriptions' && parts[3] === 'resourcegroups') {
        context.valuesToMask.push(parts[2]);
        context.valuesToMask.push(parts[4]);

        if (parts[5] === 'providers' && parts[6]?.startsWith('microsoft.') && parts[8]) {
            context.valuesToMask.push(parts[8]);
        }
    }
}

export async function callWithMaskHandling<T>(callback: () => Promise<T>, valueToMask: string): Promise<T> {
    try {
        return await callback();
    } catch (error) {
        const parsedError: IParsedError = parseError(error, message => maskValue(message, valueToMask));

        if (parsedError.isUserCancelledError) {
            throw error;
        }

        // eslint-disable-next-line preserve-caught-error -- intentionally omit `cause`: the caught error may contain unmasked PII and must not be attached to the rethrown error
        throw new Error(parsedError.message);
    }
}

/**
 * Masks only explicit action and extension values.
 * Heuristic telemetry cleaning is handled by VS Code's telemetry logger.
 * This function alone is not a general-purpose scrubber for logs or issue reports.
 */
export function maskUserInfo(unknownArg: unknown, actionValuesToMask: string[]): string {
    let data = String(unknownArg);

    // Mask longest values first just in case one is a substring of another
    const valuesToMask = actionValuesToMask.concat(getExtValuesToMask()).sort((a, b) => b.length - a.length);
    for (const value of valuesToMask) {
        data = maskValue(data, value);
    }

    return data;
}

function escapeRegExp(str: string): string {
    return str
        .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
        .replace(/-/g, '\\x2d');
}

/**
 * Mask a single specific value
 */
export function maskValue(data: string, valueToMask: string | undefined): string {
    if (valueToMask) {
        const formsOfValue: string[] = [valueToMask, encodeURIComponent(valueToMask)];
        for (const v of formsOfValue) {
            data = data.replace(new RegExp(escapeRegExp(v), 'gi'), '---');
        }
    }
    return data;
}

export function getRedactedLabel(reason: string): string {
    return `redacted:${reason}`;
}
