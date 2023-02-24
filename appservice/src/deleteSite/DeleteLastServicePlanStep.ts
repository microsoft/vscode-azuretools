/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, DialogResponses, nonNullProp } from "@microsoft/vscode-azext-utils";
import { isNullOrUndefined } from "util";
import { l10n, MessageItem } from "vscode";
import { IDeleteSiteWizardContext } from "./IDeleteSiteWizardContext";

export class DeleteLastServicePlanStep extends AzureWizardPromptStep<IDeleteSiteWizardContext> {

    public async prompt(context: IDeleteSiteWizardContext): Promise<void> {
        const site = nonNullProp(context, "site");
        const client = await site.createClient(context);

        const plan = await client.getAppServicePlan();
        if (plan && !isNullOrUndefined(plan.numberOfSites) && plan.numberOfSites < 2) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const message: string = l10n.t('This is the last app in the App Service plan "{0}". Do you want to delete this App Service plan to prevent unexpected charges?', plan.name!);
            const input: MessageItem = await context.ui.showWarningMessage(message, { modal: true, stepName: 'lastAppOnPlan' }, DialogResponses.yes, DialogResponses.no);
            context.deletePlan = input === DialogResponses.yes;
        }
    }

    public shouldPrompt(context: IDeleteSiteWizardContext): boolean {
        return !nonNullProp(context, 'site').isSlot;
    }
}
