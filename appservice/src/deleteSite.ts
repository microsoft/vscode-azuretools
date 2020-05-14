/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan } from 'azure-arm-website/lib/models';
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { DialogResponses } from 'vscode-azureextensionui';
import { ISiteClient } from './';
import { ext } from './extensionVariables';
import { localize } from './localize';

export async function deleteSite(client: ISiteClient): Promise<void> {
    const confirmMessage: string = localize('deleteConfirmation', 'Are you sure you want to delete "{0}"?', client.fullName);
    await ext.ui.showWarningMessage(confirmMessage, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);

    let plan: AppServicePlan | undefined;
    let deletePlan: boolean = false;

    if (!client.isSlot) {
        // API calls not necessary for deployment slots
        plan = await client.getAppServicePlan();
    }

    if (!client.isSlot && plan && !isNullOrUndefined(plan.numberOfSites) && plan.numberOfSites < 2) {
        const message: string = localize('deleteLastServicePlan', 'This is the last app in the App Service plan "{0}". Do you want to delete this App Service plan to prevent unexpected charges?', plan.name);
        const input: vscode.MessageItem = await ext.ui.showWarningMessage(message, { modal: true }, DialogResponses.yes, DialogResponses.no, DialogResponses.cancel);
        deletePlan = input === DialogResponses.yes;
    }

    const deleting: string = localize('Deleting', 'Deleting "{0}"...', client.fullName);
    const deleteSucceeded: string = localize('DeleteSucceeded', 'Successfully deleted "{0}".', client.fullName);
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: deleting }, async (): Promise<void> => {
        ext.outputChannel.appendLog(deleting);
        await client.deleteMethod({ deleteEmptyServerFarm: deletePlan });
        vscode.window.showInformationMessage(deleteSucceeded);
        ext.outputChannel.appendLog(deleteSucceeded);
    });
}
