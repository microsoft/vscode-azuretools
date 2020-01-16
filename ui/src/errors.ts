/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "..";
import { localize } from "./localize";

// tslint:disable: max-classes-per-file

export class UserCancelledError extends Error {
    constructor() {
        super(localize('userCancelledError', 'Operation cancelled.'));
    }
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

export class NoResouceFoundError extends Error {
    constructor(errorMessage?: string, context?: IActionContext) {
        if (errorMessage) {
            super(errorMessage);
            if (context) {
                context.errorHandling.suppressReportIssue = true;
            }
        } else {
            super(localize('noResourcesError', 'No matching resources found.'));
        }
    }
}
