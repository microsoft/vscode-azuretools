/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import { IActionContext, IParsedError } from "../index";
import { parseError } from "./parseError";

// No attempt will be made to mask usernames that are this length or less
const UnmaskedUsernameMaxLength: number = 3;

// eslint-disable-next-line @typescript-eslint/naming-convention
let _extValuesToMask: string[] | undefined;
function getExtValuesToMask(): string[] {
    _extValuesToMask ??= [];
    return _extValuesToMask;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
let _usernameMask: RegExp | undefined | null = undefined;
function getUsernameMask(getUsername: () => string): RegExp | undefined | null {
    if (_usernameMask === undefined) {
        try {
            const username = getUsername();
            _usernameMask = username.length <= UnmaskedUsernameMaxLength ? null : new RegExp(`\\b${escapeRegExp(username)}\\b`, 'gi');
        } catch {
            _usernameMask = null;
        }
    }

    return _usernameMask;
}

/**
 * To be used ONLY by test code.
 */
export function resetUsernameMask(): void {
    _usernameMask = undefined;
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
 * Supplementary masking for explicit values, usernames, ID-like strings and bare domains.
 * VS Code's telemetry logger handles emails, scheme URLs, JWTs and generic secrets at send time.
 * This function alone is not a general-purpose scrubber for logs or issue reports.
 * @param lessAggressive If set to true, ID-like string masking will be skipped.
 * @param getUsername To be used ONLY by test code. Function used to get the username.
 */
export function maskUserInfo(unknownArg: unknown, actionValuesToMask: string[], lessAggressive: boolean = false, getUsername = () => os.userInfo().username): string {
    let data = String(unknownArg);

    // Mask longest values first just in case one is a substring of another
    const valuesToMask = actionValuesToMask.concat(getExtValuesToMask()).sort((a, b) => b.length - a.length);
    for (const value of valuesToMask) {
        data = maskValue(data, value);
    }

    if (!lessAggressive) {
        data = data.replace(/\b[0-9a-f:.-]{4,}\b/gi, getRedactedLabel('id'));
    }
    data = data.replace(/\S+/g, token => hasDomain(token) ? getRedactedLabel('url') : token);

    const usernameMask = getUsernameMask(getUsername);
    if (usernameMask) {
        data = data.replace(usernameMask, getRedactedLabel('username'));
    }

    return data;
}

function hasDomain(token: string): boolean {
    for (const match of token.matchAll(/\.(com|org|net)/gi)) {
        const aspStart = match.index - 3;
        const isAsp = token.slice(Math.max(0, aspStart), match.index).toLowerCase() === 'asp' &&
            (aspStart === 0 || /[^\w-]/.test(token[aspStart - 1]));
        if (match.index > 0 && !isAsp) {
            return true;
        }
    }
    return false;
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
