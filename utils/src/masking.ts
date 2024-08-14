/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as escape from 'escape-string-regexp';
import * as os from 'os';
import { IActionContext, IParsedError } from "../index";
import { parseError } from "./parseError";

// No attempt will be made to mask usernames that are this length or less
const UnmaskedUsernameMaxLength: number = 3;

let _extValuesToMask: string[] | undefined;
function getExtValuesToMask(): string[] {
    if (!_extValuesToMask) {
        _extValuesToMask = [];
    }
    return _extValuesToMask;
}

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
                _usernameMask = new RegExp(`\\b${username}\\b`, 'gi');
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

    // Loose pattern matching to identify any JWT-like character sequences; prevents any accidental inclusions to telemetry
    // The first and second JWT sections begin with "e" since the header and payload represent encoded json values that always begin with "{"
    data = data.replace(/e[^\.\s]*\.e[^\.\s]*\.[^\.\s]+/gi, getRedactedLabel('jwt'));

    if (!lessAggressive) {
        data = data.replace(/\S+@\S+/gi, getRedactedLabel('email'));
        data = data.replace(/\b[0-9a-f\-\:\.]{4,}\b/gi, getRedactedLabel('id')); // should cover guids, ip addresses, etc.
    }

    data = data.replace(/[a-z]+:\/\/\S*/gi, getRedactedLabel('url'));
    data = data.replace(/\S+(?<!(?<!\-)\basp)\.(com|org|net)\S*/gi, getRedactedLabel('url'));
    data = data.replace(/\S*(key|token|sig|password|passwd|pwd)[="':\s]+\S*/gi, getRedactedLabel('key'));

    const usernameMask = getUsernameMask(getUsername);
    if (usernameMask) {
        data = data.replace(usernameMask, getRedactedLabel('username'));
    }

    return data;
}

/**
 * Mask a single specific value
 */
export function maskValue(data: string, valueToMask: string | undefined): string {
    if (valueToMask) {
        const formsOfValue: string[] = [valueToMask, encodeURIComponent(valueToMask)];
        for (const v of formsOfValue) {
            data = data.replace(new RegExp(escape(v), 'gi'), '---');
        }
    }
    return data;
}

export function getRedactedLabel(reason: string): string {
    return `redacted:${reason}`;
}
