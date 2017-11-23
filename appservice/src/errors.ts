/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from "./localize";

export class UserCancelledError extends Error { }

export class WizardFailedError extends Error {
    public readonly stepTitle: string;
    public readonly stepIndex: number;
    constructor(error: Error, stepTitle: string, stepIndex: number) {
        super();
        this.message = error.message;
        this.stepTitle = stepTitle;
        this.stepIndex = stepIndex;
    }
}

export class ArgumentError extends Error {
    constructor(obj: object) {
        super(localize('azApp.argumentError', 'Invalid {0}.', obj.constructor.name));
    }
}
