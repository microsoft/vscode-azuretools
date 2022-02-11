/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AppServicePlan } from '@azure/arm-appservice';
import { DialogResponses, IActionContext } from '@microsoft/vscode-azext-utils';
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { ext } from './extensionVariables';
import { localize } from './localize';
import { ParsedSite } from './SiteClient';

export async function deleteSite(context: IActionContext, site: ParsedSite): Promise<void> {
    const confirmMessage: string = site.isSlot ?
        localize('confirmDeleteSlot', 'Are you sure you want to delete slot "{0}"?', site.fullName) :
        site.isFunctionApp ?
            localize('confirmDeleteFunctionApp', 'Are you sure you want to delete function app "{0}"?', site.fullName) :
            localize('confirmDeleteWebApp', 'Are you sure you want to delete web app "{0}"?', site.fullName);

    await context.ui.showWarningMessage(confirmMessage, { modal: true, stepName: 'confirmDelete' }, DialogResponses.deleteResponse);

    let plan: AppServicePlan | undefined;
    let deletePlan: boolean = false;

    const client = await site.createClient(context);
    if (!site.isSlot) {
        // API calls not necessary for deployment slots
        plan = await client.getAppServicePlan();
    }

    if (!site.isSlot && plan && !isNullOrUndefined(plan.numberOfSites) && plan.numberOfSites < 2) {
        const message: string = localize('deleteLastServicePlan', 'This is the last app in the App Service plan "{0}". Do you want to delete this App Service plan to prevent unexpected charges?', plan.name);
        const input: vscode.MessageItem = await context.ui.showWarningMessage(message, { modal: true, stepName: 'lastAppOnPlan' }, DialogResponses.yes, DialogResponses.no);
        deletePlan = input === DialogResponses.yes;
    }

    const deleting: string = site.isSlot ?
        localize('DeletingSlot', 'Deleting slot "{0}"...', site.fullName) :
        site.isFunctionApp ?
            localize('DeletingFunctionApp', 'Deleting function app "{0}"...', site.fullName) :
            localize('DeletingWebApp', 'Deleting web app "{0}"...', site.fullName);

    const deleteSucceeded: string = site.isSlot ?
        localize('deletedSlot', 'Successfully deleted slot "{0}".', site.fullName) :
        site.isFunctionApp ?
            localize('deletedFunctionApp', 'Successfully deleted function app "{0}".', site.fullName) :
            localize('deletedWebApp', 'Successfully deleted web app "{0}".', site.fullName);

    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: deleting }, async (): Promise<void> => {
        ext.outputChannel.appendLog(deleting);
        await client.deleteMethod({ deleteEmptyServerFarm: deletePlan });
        void vscode.window.showInformationMessage(deleteSucceeded);
        ext.outputChannel.appendLog(deleteSucceeded);
    });
}
