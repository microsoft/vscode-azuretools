/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export async function delay(delayMs: number): Promise<void> {
    await new Promise<void>((resolve: () => void): void => { setTimeout(resolve, delayMs); });
}
