/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITreeItemPickerContext } from "..";
import { localize } from "./localize";

export class UserCancelledError extends Error {
    _isUserCancelledError = true;
    public stepName: string | undefined;
    constructor(stepName?: string) {
        super(localize('userCancelledError', 'Operation cancelled.'));
        this.stepName = stepName;
    }
}

export function isUserCancelledError(error: unknown): error is UserCancelledError {
    return typeof error === 'object' && (error as UserCancelledError)._isUserCancelledError;
}

export class GoBackError extends Error {
    constructor() {
        super(localize('backError', 'Go back.'));
    }
}

export class NotImplementedError extends Error {
    constructor(methodName: string, obj: object) {
        super(localize('notImplementedError', '"{0}" is not implemented on "{1}".', methodName, obj.constructor.name));
    }
}

export class NoResourceFoundError extends Error {
    constructor(context?: ITreeItemPickerContext) {
        if (context && context.noItemFoundErrorMessage) {
            super(context.noItemFoundErrorMessage);
            context.errorHandling.suppressReportIssue = true;
        } else {
            super(localize('noResourcesError', 'No matching resources found.'));
        }
    }
}
