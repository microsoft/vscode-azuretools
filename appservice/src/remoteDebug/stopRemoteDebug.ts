/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { SiteClient } from '../SiteClient';
import { remoteDebugLink, setRemoteDebug } from './remoteDebugCommon';

export async function stopRemoteDebug(siteClient: SiteClient, siteConfig: SiteConfigResource): Promise<void> {
    const confirmMessage: string = 'The app configuration will be updated to disable remote debugging and restarted. Would you like to continue?';
    const noopMessage: string = 'The app is not configured for debugging.';

    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress: vscode.Progress<{}>): Promise<void> => {
        await setRemoteDebug(false, confirmMessage, noopMessage, siteClient, siteConfig, progress, remoteDebugLink);
    });
}
