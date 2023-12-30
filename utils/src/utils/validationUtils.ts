/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export namespace validationUtils {
    export interface RangeConstraints {
        lowerLimitIncl?: number;
        upperLimitIncl?: number;
    }

    export function hasValidCharLength(value: string, c?: RangeConstraints): boolean {
        const lowerLimitIncl = (!c?.lowerLimitIncl || c.lowerLimitIncl < 1) ? 1 : c.lowerLimitIncl;
        const upperLimitIncl = (!c?.upperLimitIncl || c.upperLimitIncl > Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : c.upperLimitIncl;
        return lowerLimitIncl <= upperLimitIncl && value.length >= lowerLimitIncl && value.length <= upperLimitIncl;
    }

    export function getInvalidCharLengthMessage(c?: RangeConstraints): string {
        if (!c?.lowerLimitIncl && !c?.upperLimitIncl) {
            return vscode.l10n.t('A value is required to proceed.');
        } else if (c?.lowerLimitIncl && !c?.upperLimitIncl) {
            return vscode.l10n.t('The value must be {0} characters or greater.', c.lowerLimitIncl);
        } else if (!c?.lowerLimitIncl && c?.upperLimitIncl) {
            return vscode.l10n.t('The value must be {0} characters or less.', c.upperLimitIncl);
        } else {
            return vscode.l10n.t('The value must be between {0} and {1} characters long.', <number>c.lowerLimitIncl, <number>c.upperLimitIncl);
        }
    }
}
