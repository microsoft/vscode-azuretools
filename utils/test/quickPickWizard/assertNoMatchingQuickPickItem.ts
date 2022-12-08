/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { assertThrowsAsync } from "../assertThrowsAsync";

export function assertNoMatchingQuickPickItem(block: () => Promise<void>): Promise<void> {
    const noMatchingQuickPickItem = /Did not find quick pick item matching/;
    return assertThrowsAsync(block, noMatchingQuickPickItem);
}
