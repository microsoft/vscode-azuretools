/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as escape from 'escape-string-regexp';
import * as os from 'os';
import { IActionContext, IParsedError } from "../index";
import { parseError } from "./parseError";
import { AzExtTreeItem } from './tree/AzExtTreeItem';

let _extValuesToMask: string[] | undefined;
function getExtValuesToMask(): string[] {
    if (!_extValuesToMask) {
        try {
            _extValuesToMask = [os.userInfo().username];
        } catch {
            _extValuesToMask = [];
        }
    }
    return _extValuesToMask;
}

export function addExtensionValueToMask(...values: string[]): void {
    const extValuesToMask: string[] = getExtValuesToMask();
    for (const v of values) {
        if (!extValuesToMask.includes(v)) {
            extValuesToMask.push(v);
        }
    }
}

/**
 * Example id: /subscriptions/00000000-0000-0000-0000-00000000/resourceGroups/rg1/providers/Microsoft.Web/sites/site1
 */
export function addValuesToMaskFromAzureId(context: IActionContext, node: AzExtTreeItem): void {
    const parts: string[] = node.fullId.toLowerCase().split('/');
    if (parts[1] === 'subscriptions' && parts[3] === 'resourcegroups') { // NOTE: subscription id is already added to extValuesToMask elsewhere
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

export function maskValues(data: string, valuesToMask: string[]): string {
    for (const value of valuesToMask.concat(getExtValuesToMask())) {
        data = maskValue(data, value);
    }
    return data;
}

function maskValue(data: string, valueToMask: string): string {
    if (valueToMask) {
        const formsOfValue: string[] = [valueToMask, encodeURIComponent(valueToMask)];
        for (const v of formsOfValue) {
            data = data.replace(new RegExp(escape(v), 'gi'), '---');
        }
    }
    return data;
}
