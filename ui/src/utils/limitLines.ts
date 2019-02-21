/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Limit string 's' to at most 'n' lines
 */
export function limitLines(s: string | undefined, n: number): string {
    // tslint:disable-next-line: strict-boolean-expressions
    s = s || '';
    const match: RegExpMatchArray | null = s.match(new RegExp(`((\\r\\n|\\n)?.*$){0,${n}}`, 'm'));
    return match ? match[0] : '';
}
