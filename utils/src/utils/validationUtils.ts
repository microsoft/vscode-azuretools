/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Input string validation utilities for Azure Tools
 */
export namespace validationUtils {
    /**
     * A generic set of validation utilities that can be used for most input strings
     */
    export namespace General {
        /**
         * Checks if the given input string has a valid length as determined by the optional lower and upper limit parameters
         * @related getInvalidCharLengthMessage
         */
        export function hasValidCharLength(value: string, lowerLimitIncl?: number, upperLimitIncl?: number): boolean {
            lowerLimitIncl = (!lowerLimitIncl || lowerLimitIncl < 1) ? 1 : lowerLimitIncl;
            upperLimitIncl = (!upperLimitIncl || upperLimitIncl > Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : upperLimitIncl;
            return lowerLimitIncl <= upperLimitIncl && value.length >= lowerLimitIncl && value.length <= upperLimitIncl;
        }

        /**
         * Provides a message that can be used to inform the user of invalid string length as determined by the optional lower and upper limit parameters
         * @related hasValidCharLength
         */
        export function getInvalidCharLengthMessage(lowerLimitIncl?: number, upperLimitIncl?: number): string {
            if (!lowerLimitIncl && !upperLimitIncl) {
                return vscode.l10n.t('A value is required to proceed.');
            } else if (lowerLimitIncl && !upperLimitIncl) {
                return vscode.l10n.t('The value must be {0} characters or greater.', lowerLimitIncl);
            } else if (!lowerLimitIncl && upperLimitIncl) {
                return vscode.l10n.t('The value must be {0} characters or less.', upperLimitIncl);
            } else {
                return vscode.l10n.t('The value must be between {0} and {1} characters long.', <number>lowerLimitIncl, <number>upperLimitIncl);
            }
        }
    }

    // Todo..
    /**
     * Validation for strings representing an int or float
     */
    // export namespace Numerical {}
}
