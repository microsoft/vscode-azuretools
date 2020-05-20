/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan } from 'azure-arm-website/lib/models';
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { DialogResponses } from 'vscode-azureextensionui';
import { ext } from './extensionVariables';
import { localize } from './localize';
import { SiteClient } from './SiteClient';

export async function deleteSite(client: SiteClient): Promise<void> {
    const confirmMessage: string = client.isSlot ?
        localize('confirmDeleteSlot', 'Are you sure you want to delete slot "{0}"?', client.fullName) :
        client.isFunctionApp ?
            localize('confirmDeleteFunctionApp', 'Are you sure you want to delete function app "{0}"?', client.fullName) :
            localize('confirmDeleteWebApp', 'Are you sure you want to delete web app "{0}"?', client.fullName);

    await ext.ui.showWarningMessage(confirmMessage, { modal: true }, DialogResponses.deleteResponse);

    let plan: AppServicePlan | undefined;
    let deletePlan: boolean = false;

    if (!client.isSlot) {
        // API calls not necessary for deployment slots
        plan = await client.getAppServicePlan();
    }

    if (!client.isSlot && plan && !isNullOrUndefined(plan.numberOfSites) && plan.numberOfSites < 2) {
        const message: string = localize('deleteLastServicePlan', 'This is the last app in the App Service plan "{0}". Do you want to delete this App Service plan to prevent unexpected charges?', plan.name);
        const input: vscode.MessageItem = await ext.ui.showWarningMessage(message, { modal: true }, DialogResponses.yes, DialogResponses.no);
        deletePlan = input === DialogResponses.yes;
    }

    const deleting: string = client.isSlot ?
        localize('DeletingSlot', 'Deleting slot "{0}"...', client.fullName) :
        client.isFunctionApp ?
            localize('DeletingFunctionApp', 'Deleting function app "{0}"...', client.fullName) :
            localize('DeletingWebApp', 'Deleting web app "{0}"...', client.fullName);

    const deleteSucceeded: string = client.isSlot ?
        localize('deletedSlot', 'Successfully deleted slot "{0}".', client.fullName) :
        client.isFunctionApp ?
            localize('deletedFunctionApp', 'Successfully deleted function app "{0}".', client.fullName) :
            localize('deletedWebApp', 'Successfully deleted web app "{0}".', client.fullName);

    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: deleting }, async (): Promise<void> => {
        ext.outputChannel.appendLog(deleting);
        await client.deleteMethod({ deleteEmptyServerFarm: deletePlan });
        vscode.window.showInformationMessage(deleteSucceeded);
        ext.outputChannel.appendLog(deleteSucceeded);
    });
}
