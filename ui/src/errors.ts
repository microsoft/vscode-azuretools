/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from "./localize";

export class UserCancelledError extends Error {
    private readonly _isUserCancelledError: boolean = true;

    constructor() {
        super(localize('userCancelledError', 'Operation cancelled.'));
    }

    // Workaround to fix "instanceof UserCancelledError" when testing package with "npm link"
    // tslint:disable-next-line:function-name no-any
    public static [Symbol.hasInstance](instance: any): boolean {
        return instance !== null && typeof instance === 'object' && !!(<UserCancelledError>instance)._isUserCancelledError;
    }
}

export class NotImplementedError extends Error {
    constructor(methodName: string, obj: object) {
        super(localize('notImplementedError', '"{0}" is not implemented on "{1}".', methodName, obj.constructor.name));
    }
}

export class ArgumentError extends Error {
    constructor(obj: object) {
        super(localize('argumentError', 'Invalid {0}.', obj.constructor.name));
    }
}
