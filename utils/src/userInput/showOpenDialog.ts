/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OpenDialogOptions, Uri, window } from 'vscode';
import { UserCancelledError } from '../errors';
import type { IActionContext } from '../../index';
import { recordWorkflowUserDismissal, startWorkflowUserWait } from '../workflowTelemetry';

export async function showOpenDialog(options: OpenDialogOptions, context?: IActionContext): Promise<Uri[]> {
    const timer = context && startWorkflowUserWait(context);
    let result: Uri[] | undefined;
    try {
        result = await window.showOpenDialog(options);
    } finally {
        timer?.dispose();
    }

    if (result === undefined || result.length === 0) {
        if (context) {
            recordWorkflowUserDismissal(context);
        }
        throw new UserCancelledError();
    } else {
        return result;
    }
}
