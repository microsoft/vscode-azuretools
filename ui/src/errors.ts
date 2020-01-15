/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "..";
import { localize } from "./localize";

// tslint:disable: max-classes-per-file
export class OverwriteActionContextError extends Error {
    public actionContext?: Partial<IActionContext>;

    constructor(message?: string, actionContext?: Partial<IActionContext>) {
        super(message);
        this.actionContext = actionContext;
    }
}

export class UserCancelledError extends OverwriteActionContextError {
    constructor() {
        const context: Partial<IActionContext> = {
            errorHandling: {
                suppressDisplay: true,
                suppressReportIssue: true,
                issueProperties: {}
            }
        };
        super(localize('userCancelledError', 'Operation cancelled.'), context);
    }
}

export class GoBackError extends OverwriteActionContextError {
    constructor() {
        super(localize('backError', 'Go back.'));
    }
}

export class NotImplementedError extends OverwriteActionContextError {
    constructor(methodName: string, obj: object) {
        super(localize('notImplementedError', '"{0}" is not implemented on "{1}".', methodName, obj.constructor.name));
    }
}

export class NoResouceFoundError extends OverwriteActionContextError {
    constructor() {
        const context: Partial<IActionContext> = {
            errorHandling: {
                suppressReportIssue: true,
                issueProperties: {}
            }
        };
        super(localize('noResourcesError', 'No matching resources found.'), context);
    }
}
