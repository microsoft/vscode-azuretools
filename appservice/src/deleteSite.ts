/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { UserCancelledError } from 'vscode-azureextensionui';
import { DialogResponses } from './DialogResponses';
import { localize } from './localize';
import { SiteClient } from './SiteClient';

export async function deleteSite(client: SiteClient, outputChannel: vscode.OutputChannel): Promise<void> {
    const confirmMessage: string = localize('deleteConfirmation', 'Are you sure you want to delete "{0}"?', client.fullName);
    if (await vscode.window.showWarningMessage(confirmMessage, DialogResponses.yes, DialogResponses.cancel) !== DialogResponses.yes) {
        throw new UserCancelledError();
    }

    let plan: AppServicePlan | undefined;
    let deletePlan: boolean = false;

    if (!client.isSlot) {
        // API calls not necessary for deployment slots
        plan = await client.getAppServicePlan();
    }

    if (!client.isSlot && plan.numberOfSites < 2) {
        const message: string = localize('deleteLastServicePlan', 'This is the last app in the App Service plan "{0}". Do you want to delete this App Service plan to prevent unexpected charges?', plan.name);
        const input: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(message, DialogResponses.yes, DialogResponses.no, DialogResponses.cancel);
        if (input === undefined) {
            throw new UserCancelledError();
        } else {
            deletePlan = input === DialogResponses.yes;
        }
    }

    outputChannel.show();
    outputChannel.appendLine(localize('Deleting', 'Deleting "{0}"...', client.fullName));
    await client.deleteMethod({ deleteEmptyServerFarm: deletePlan });
    outputChannel.appendLine(localize('DeleteSucceeded', 'Successfully deleted "{0}".', client.fullName));
}
