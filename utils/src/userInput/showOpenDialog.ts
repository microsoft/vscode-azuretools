/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OpenDialogOptions, Uri, window } from 'vscode';
import { UserCancelledError } from '../errors';

export async function showOpenDialog(options: OpenDialogOptions): Promise<Uri[]> {
    const result: Uri[] | undefined = await window.showOpenDialog(options);

    if (result === undefined || result.length === 0) {
        throw new UserCancelledError();
    } else {
        return result;
    }
}
