/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { KnownClientType } from "@azure/arm-servicelinker";
import { AzureWizardPromptStep, IAzureQuickPickItem } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { ICreateLinkerContext } from "./ICreateLinkerContext";

export class ClientTypeStep extends AzureWizardPromptStep<ICreateLinkerContext>{
    public async prompt(context: ICreateLinkerContext): Promise<void> {
        const placeHolder = vscode.l10n.t('Select Language/Framework');
        const picks: IAzureQuickPickItem<KnownClientType>[] = [
            { label: vscode.l10n.t('None'), data: KnownClientType.None },
            { label: vscode.l10n.t('.NET'), data: KnownClientType.Dotnet },
            { label: vscode.l10n.t('Java'), data: KnownClientType.Java },
            { label: vscode.l10n.t('Node.js'), data: KnownClientType.Nodejs },
            { label: vscode.l10n.t('Python'), data: KnownClientType.Python },
            { label: vscode.l10n.t('Go'), data: KnownClientType.Go },
            { label: vscode.l10n.t('Ruby'), data: KnownClientType.Ruby },
            { label: vscode.l10n.t('PHP'), data: KnownClientType.Php },
            { label: vscode.l10n.t('Django'), data: KnownClientType.Django },
            { label: vscode.l10n.t('SpringBoot'), data: KnownClientType.SpringBoot },
        ];

        context.clientType = (await context.ui.showQuickPick(picks, { placeHolder })).data;
    }

    public shouldPrompt(context: ICreateLinkerContext): boolean {
        return !context.clientType;
    }
}
