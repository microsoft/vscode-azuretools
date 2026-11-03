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
    // _usernameMask starts out as undefined, and is set to null if building it fails or it is too short
    // Specifically checking for undefined here ensures we will only run the code once
    if (_usernameMask === undefined) {
        try {
            const username = getUsername();

            if (username.length <= UnmaskedUsernameMaxLength) {
                // Too short to mask
                _usernameMask = null;
            } else {
                _usernameMask = new RegExp(`\\b${escapeRegExp(username)}\\b`, 'gi');
            }
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
        const parsedError: IParsedError = parseError(error);

        if (parsedError.isUserCancelledError) {
            throw error;
        }

        // eslint-disable-next-line preserve-caught-error -- intentionally omit `cause`: the caught error may contain unmasked PII and must not be attached to the rethrown error
        throw new Error(maskValue(parsedError.message, valueToMask));
    }
}

/**
 * Best effort to mask all data that could potentially identify a user
 * @param lessAggressive If set to true, the most aggressive masking will be skipped
 * @param getUsername To be used ONLY by test code. Function used to get the username.
 */
export function maskUserInfo(unknownArg: unknown, actionValuesToMask: string[], lessAggressive: boolean = false, getUsername = () => os.userInfo().username): string {
    let data = String(unknownArg);

    // Mask longest values first just in case one is a substring of another
    const valuesToMask = actionValuesToMask.concat(getExtValuesToMask()).sort((a, b) => b.length - a.length);
    for (const value of valuesToMask) {
        data = maskValue(data, value);
    }

    // Protect cross-token assignments before email/URL masking can remove their key or opening quote.
    data = maskSecretAssignments(data, true, text => maskSecretAssignments(maskTokens(text, lessAggressive)));

    const usernameMask = getUsernameMask(getUsername);
    if (usernameMask) {
        data = data.replace(usernameMask, getRedactedLabel('username'));
    }

    return data;
}

function maskTokens(data: string, lessAggressive: boolean): string {
    return data.replace(/\S+/g, token => {
        token = maskJwtSegments(token);
        const at = token.indexOf('@', 1);
        if (!lessAggressive && at > 0 && at < token.length - 1) {
            return getRedactedLabel('email');
        }
        if (!lessAggressive) {
            token = token.replace(/\b[0-9a-f:.-]{4,}\b/gi, getRedactedLabel('id'));
        }

        token = maskSchemeUrl(token);
        if (hasDomain(token)) {
            return getRedactedLabel('url');
        }
        return token;
    });
}

function maskJwtSegments(token: string): string {
    const segments = token.split('.');
    const result: string[] = [];
    for (let i = 0; i < segments.length; i++) {
        const firstE = /e/i.exec(segments[i])?.index ?? -1;
        if (firstE >= 0 && segments[i + 1]?.[0]?.toLowerCase() === 'e' && segments[i + 2]) {
            result.push(segments[i].slice(0, firstE) + getRedactedLabel('jwt'));
            i += 2;
        } else {
            result.push(segments[i]);
        }
    }
    return result.join('.');
}

function maskSchemeUrl(token: string): string {
    let position = token.indexOf('://');
    while (position >= 0) {
        let start = position;
        while (start > 0 && /[a-z]/i.test(token[start - 1])) {
            start--;
        }
        if (start < position) {
            return token.slice(0, start) + getRedactedLabel('url');
        }
        position = token.indexOf('://', position + 3);
    }
    return token;
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

function maskSecretAssignments(data: string, crossTokenOnly = false, transformText = (text: string): string => text): string {
    const keyword = /key|token|sig|password|passwd|pwd/iy;
    const parts: string[] = [];
    let copied = 0;
    let position = 0;
    while (position < data.length) {
        if (/\s/.test(data[position])) {
            position++;
            continue;
        }
        const tokenStart = position;
        let first: number | undefined;
        let last: number | undefined;
        while (position < data.length && !/\s/.test(data[position])) {
            keyword.lastIndex = position;
            if (keyword.test(data) && /[="':\s]/.test(data[keyword.lastIndex] ?? '')) {
                first ??= keyword.lastIndex;
                last = keyword.lastIndex;
            }
            position++;
        }
        if (first === undefined || last === undefined) {
            continue;
        }
        let end: number;
        if (crossTokenOnly) {
            end = quotedSecretEnd(data, tokenStart, first);
            if (last !== first) {
                end = Math.max(end, quotedSecretEnd(data, tokenStart, last));
            }
            if (end < 0) {
                continue;
            }
        } else {
            // The old greedy rule chose the rightmost marker in a token, including one
            // whose separator/value continues on the next line.
            end = last;
            while (end < data.length && /[="':\s]/.test(data[end])) {
                end++;
            }
            while (end < data.length && !/\s/.test(data[end])) {
                end++;
            }
        }
        parts.push(transformText(data.slice(copied, tokenStart)), getRedactedLabel('key'));
        copied = end;
        position = end;
    }
    parts.push(transformText(data.slice(copied)));
    return parts.join('');
}

function quotedSecretEnd(data: string, tokenStart: number, position: number): number {
    // A quote followed by a separator closes a quoted key, not its value.
    if (/["']/.test(data[position]) && /[=:\s]/.test(data[position + 1] ?? '')) {
        position++;
    }
    while (position < data.length && /[=:\s]/.test(data[position])) {
        position++;
    }
    let quote: string | undefined;
    let quoted = false;
    while (position < data.length) {
        const char = data[position];
        if (quote) {
            if (char === '\\' && position + 1 < data.length) {
                position += 2;
                continue;
            }
            if (char === quote) {
                quote = undefined;
            }
        } else if (char === '"' || char === "'") {
            quote = char;
            quoted = true;
        } else if (/\s/.test(char)) {
            break;
        }
        position++;
    }
    return quoted && /\s/.test(data.slice(tokenStart, position)) ? position : -1;
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
