/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, nonNullProp } from "@microsoft/vscode-azext-utils";
import { l10n, Progress } from "vscode";
import { ext } from "../extensionVariables";
import { IDeleteSiteWizardContext } from "./IDeleteSiteWizardContext";

export class DeleteSiteStep extends AzureWizardExecuteStep<IDeleteSiteWizardContext> {
    public priority: number = 100;

    public async execute(context: IDeleteSiteWizardContext, progress: Progress<{ message?: string | undefined; increment?: number | undefined; }>): Promise<void> {

        const site = nonNullProp(context, "site");

        let deleting: string;
        let deleteSucceeded: string;

        if (site.isSlot) {
            deleting = l10n.t('Deleting slot "{0}"...', site.fullName);
            deleteSucceeded = l10n.t('Successfully deleted slot "{0}".', site.fullName);
        } else if (site.isFunctionApp) {
            deleting = l10n.t('Deleting function app "{0}"...', site.fullName);
            deleteSucceeded = l10n.t('Successfully deleted function app "{0}".', site.fullName);
        } else {
            deleting = l10n.t('Deleting web app "{0}"...', site.fullName);
            deleteSucceeded = l10n.t('Successfully deleted web app "{0}".', site.fullName);
        }

        ext.outputChannel.appendLog(deleting);
        progress.report({ message: deleting });
        const client = await site.createClient(context);
        await client.deleteMethod({ deleteEmptyServerFarm: context.deletePlan });
        ext.outputChannel.appendLog(deleteSucceeded);
    }

    public shouldExecute(): boolean {
        return true;
    }
}
