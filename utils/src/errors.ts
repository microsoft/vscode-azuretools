/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ITreeItemPickerContext } from "../index";

export class UserCancelledError extends Error {
    _isUserCancelledError = true;
    public stepName: string | undefined;
    constructor(stepName?: string) {
        super(vscode.l10n.t('Operation cancelled.'));
        this.stepName = stepName;
    }
}

export function isUserCancelledError(error: unknown): error is UserCancelledError {
    return !!error &&
        typeof error === 'object' &&
        '_isUserCancelledError' in error &&
        error._isUserCancelledError === true;
}

export class GoBackError extends Error {
    constructor() {
        super(vscode.l10n.t('Go back.'));
    }
}

export class NotImplementedError extends Error {
    constructor(methodName: string, obj: object) {
        super(vscode.l10n.t('"{0}" is not implemented on "{1}".', methodName, obj.constructor.name));
    }
}

export class NoResourceFoundError extends Error {
    constructor(context?: ITreeItemPickerContext) {
        if (context && context.noItemFoundErrorMessage) {
            super(context.noItemFoundErrorMessage);
            context.errorHandling.suppressReportIssue = true;
        } else {
            super(vscode.l10n.t('No matching resources found.'));
        }
    }
}
