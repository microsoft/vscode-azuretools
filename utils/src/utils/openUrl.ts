/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, env } from 'vscode';

export async function openUrl(url: string | Uri): Promise<void> {
    // Workaround according to https://github.com/Microsoft/vscode/issues/85930
    // When a string is passed to openExternal, it is not encoded by VS Code which seems
    // to be what is causing issues with some URLs.
    // https://github.com/microsoft/vscode/blob/2edb004e8386b2a86b26e8f30ea6969f4f26ffa7/src/vs/editor/browser/services/openerService.ts#L223-L226
    // So if a URI is causing errors, try passing a string

    await env.openExternal(url as unknown as Uri);
}
