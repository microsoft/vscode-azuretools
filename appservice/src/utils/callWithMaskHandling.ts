import { IParsedError, parseError } from "vscode-azureextensionui";

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export async function callWithMaskHandling<T>(callback: () => Promise<T>, valueToMask: string): Promise<T> {
    try {
        return await callback();
    } catch (error) {
        const parsedError: IParsedError = parseError(error);

        if (parsedError.isUserCancelledError) {
            throw error;
        }

        throw new Error(parsedError.message.replace(new RegExp(valueToMask, 'g'), '***'));
    }
}
