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

let _usernameMask: RegExp | undefined | null;
function getUsernameMask(): RegExp | undefined | null {
    if (_usernameMask === undefined) {
        try {
            const username = os.userInfo().username;

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
 */
export function maskUserInfo(unkonwnArg: unknown, actionValuesToMask: string[], lessAggressive: boolean = false): string {
    let data = String(unkonwnArg);

    // Mask longest values first just in case one is a substring of another
    const valuesToMask = actionValuesToMask.concat(getExtValuesToMask()).sort((a, b) => b.length - a.length);
    for (const value of valuesToMask) {
        data = maskValue(data, value);
    }

    if (!lessAggressive) {
        data = data.replace(/\S+@\S+/gi, getRedactedLabel('email'));
        data = data.replace(/\b[0-9a-f\-\:\.]{4,}\b/gi, getRedactedLabel('id')); // should cover guids, ip addresses, etc.
    }

    data = data.replace(/[a-z]+:\/\/\S*/gi, getRedactedLabel('url'));
    data = data.replace(/\S+(?<!(?<!\-)\basp)\.(com|org|net)\S*/gi, getRedactedLabel('url'));
    data = data.replace(/\S*(key|token|sig|password|passwd|pwd)[="':\s]+\S*/gi, getRedactedLabel('key'));

    const usernameMask = getUsernameMask();
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
