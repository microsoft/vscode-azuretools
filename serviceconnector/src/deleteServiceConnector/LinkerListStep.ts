/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { uiUtils } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardPromptStep, IAzureQuickPickItem, nonNullValue } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { IPickLinkerContext } from "./IPickLinkerContext";

export class LinkerListStep extends AzureWizardPromptStep<IPickLinkerContext>{
    public async prompt(context: IPickLinkerContext): Promise<void> {
        const placeHolder = vscode.l10n.t("Select a service connector");
        context.linkerName = (await context.ui.showQuickPick(this.getPicks(context), { placeHolder })).data;
    }

    public shouldPrompt(context: IPickLinkerContext): boolean {
        return !context.linkerName;
    }

    public async configureBeforePrompt(context: IPickLinkerContext): Promise<void> {
        const picks = await this.getPicks(context);
        if (picks.length === 1) {
            context.linkerName = picks[0].data;
        }
    }

    private async getPicks(context: IPickLinkerContext): Promise<IAzureQuickPickItem<string>[]> {
        const client = new (await import('@azure/arm-servicelinker')).ServiceLinkerManagementClient(context.credentials);
        const linkers = (await uiUtils.listAllIterator(client.linker.list(nonNullValue(context.sourceResourceUri))));
        return linkers.map(l => {
            return { label: nonNullValue(l.name), data: nonNullValue(l.name) }
        });
    }
}
