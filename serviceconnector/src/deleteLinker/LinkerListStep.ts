/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { uiUtils } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardPromptStep, IAzureQuickPickItem, nonNullProp } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { createLinkerClient } from "../linkerClient";
import { IPickLinkerContext } from "./IPickLinkerContext";

export class LinkerListStep extends AzureWizardPromptStep<IPickLinkerContext>{
    public async prompt(context: IPickLinkerContext): Promise<void> {
        context.linkerName = (await context.ui.showQuickPick(this.getPicks(context), { placeHolder: vscode.l10n.t("Select a service connector") })).data;
    }

    public shouldPrompt(context: IPickLinkerContext): boolean {
        return !context.linkerName;
    }

    private async getPicks(context: IPickLinkerContext): Promise<IAzureQuickPickItem<string>[]> {
        const client = await createLinkerClient(context.credentials);
        const linkers = (await uiUtils.listAllIterator(client.linker.list(nonNullProp(context, 'sourceResourceUri'))));
        return linkers.map(l => {
            return { label: nonNullProp(l, 'name'), data: nonNullProp(l, 'name') }
        });
    }
}
