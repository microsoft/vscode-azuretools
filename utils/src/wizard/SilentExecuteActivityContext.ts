/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExecuteActivityContext } from "../../index";

/**
 * A context that can be used to execute an activity without actually executing it
 */
export function getSilentExecuteActivityContext(): ExecuteActivityContext {
    return {
        suppressNotification: true,
        registerActivity: async (_activity) => {
            // do nothing
        },
    };
}
