/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

export function createContextValue(values: string[]): string {
    return Array.from(new Set(values)).sort().join(';');
}

export function parseContextValue(contextValue?: string): string[] {
    return contextValue?.split(';') ?? [];
}
