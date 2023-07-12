/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function isDeepEqual(obj1: object, obj2: object): boolean {
    const objKeys1: string[] = Object.keys(obj1);
    const objKeys2: string[] = Object.keys(obj2);

    if (objKeys1.length !== objKeys2.length) {
        return false;
    }

    for (const key of objKeys1) {
        const value1: unknown = obj1[key];
        const value2: unknown = obj2[key];

        const areObjects: boolean = isObject(value1) && isObject(value2);

        if ((areObjects && !isDeepEqual(<object>value1, <object>value2)) || !areObjects && value1 !== value2) {
            return false;
        }
    }

    return true;
}

function isObject(value: unknown): value is object {
    return value !== null && typeof value === "object";
}
