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

    export function hasValidCharLength(value: string, rc?: RangeConstraints): boolean {
        const lowerLimitIncl = (!rc?.lowerLimitIncl) ? 1 : rc.lowerLimitIncl;
        const upperLimitIncl = (!rc?.upperLimitIncl || rc.upperLimitIncl > Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : rc.upperLimitIncl;

        if (lowerLimitIncl < 1 || upperLimitIncl < 1) {
            throw new Error(vscode.l10n.t('Specified character lengths should be 1 character or greater.'));
        }

        if (lowerLimitIncl > upperLimitIncl) {
            throw new Error(vscode.l10n.t('The minimum specified character length should not exceed the maximum specified character length.'));
        }

        return value.length >= lowerLimitIncl && value.length <= upperLimitIncl;
    }

    export function getInvalidCharLengthMessage(rc?: RangeConstraints): string {
        if (!rc?.lowerLimitIncl && !rc?.upperLimitIncl) {
            return vscode.l10n.t('A value is required to proceed.');
        } else if (rc?.lowerLimitIncl && !rc?.upperLimitIncl) {
            return vscode.l10n.t('The value must be {0} characters or greater.', rc.lowerLimitIncl);
        } else if (!rc?.lowerLimitIncl && rc?.upperLimitIncl) {
            return vscode.l10n.t('The value must be {0} characters or less.', rc.upperLimitIncl);
        } else {
            return rc.lowerLimitIncl === rc.upperLimitIncl ?
                vscode.l10n.t('The value must be {0} characters long.', <number>rc.lowerLimitIncl) :
                vscode.l10n.t('The value must be between {0} and {1} characters long.', <number>rc.lowerLimitIncl, <number>rc.upperLimitIncl);
        }
    }
}
