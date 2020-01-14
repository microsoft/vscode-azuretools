/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from "./localize";

// tslint:disable: max-classes-per-file
export class AzureToolsError extends Error {
    public suppressDisplay: boolean = false;
    public suppressReportIssue: boolean = false;
    constructor(message?: string) {
        super(message);
    }
}

export class UserCancelledError extends AzureToolsError {
    constructor() {
        super(localize('userCancelledError', 'Operation cancelled1.'));
        this.suppressDisplay = true;
        this.suppressReportIssue = true;
    }
}

export class GoBackError extends AzureToolsError {
    constructor() {
        super(localize('backError', 'Go back.'));
    }
}

export class NotImplementedError extends AzureToolsError {
    constructor(methodName: string, obj: object) {
        super(localize('notImplementedError', '"{0}" is not implemented on "{1}".', methodName, obj.constructor.name));
    }
}

export class NoResouceFoundError extends AzureToolsError {
    constructor() {
        super(localize('noResourcesError', 'No matching resources found.'));
        this.suppressReportIssue = true;
    }
}
