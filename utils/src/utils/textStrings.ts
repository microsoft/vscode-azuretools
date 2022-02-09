/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Limit string 's' to at most 'n' lines
 */
export function limitLines(s: string, n: number): string {
    const match: RegExpMatchArray | null = s.match(new RegExp(`((\\r\\n|\\n)?.*$){0,${n}}`, 'm'));
    return match ? match[0] : '';
}

export function countLines(s: string): number {
    if (!s) {
        return 0;
    }

    const match: RegExpMatchArray | null = s.match(/(\r\n|\n)/g);
    return match ? match.length + 1 : 1;
}
