/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, nonNullProp } from "@microsoft/vscode-azext-utils";
import { Progress } from "vscode";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { IDeleteSiteWizardContext } from "./IDeleteSiteWizardContext";

export class DeleteSiteStep extends AzureWizardExecuteStep<IDeleteSiteWizardContext> {
    public priority: number = 100;

    public async execute(context: IDeleteSiteWizardContext, progress: Progress<{ message?: string | undefined; increment?: number | undefined; }>): Promise<void> {

        const site = nonNullProp(context, "site");

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
