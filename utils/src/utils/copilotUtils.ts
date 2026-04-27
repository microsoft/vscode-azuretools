/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "../..";
import { copilotUserInputCanaryKey } from "../copilot/copilotConstants";

export function isCopilotUserInput(context: IActionContext): boolean {
    return !!(context as unknown as Record<string, unknown>)[copilotUserInputCanaryKey];
}
