/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { AuthInfoBase, KnownAuthType } from "@azure/arm-servicelinker";
import { AzureWizardPromptStep, IAzureQuickPickItem } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { ICreateLinkerContext } from "./ICreateLinkerContext";

export class AuthenticationListStep extends AzureWizardPromptStep<ICreateLinkerContext>{
    public async prompt(context: ICreateLinkerContext): Promise<void> {
        const placeHolder = vscode.l10n.t('Select Authentication Type');
        const picks: IAzureQuickPickItem<AuthInfoBase>[] = [
            { label: vscode.l10n.t('System assigned managed identity'), data: { authType: KnownAuthType.SystemAssignedIdentity } },
            { label: vscode.l10n.t('Connection string'), data: { authType: KnownAuthType.Secret } },
        ];

        context.authType = (await context.ui.showQuickPick(picks, { placeHolder })).data;
    }

    public shouldPrompt(context: ICreateLinkerContext): boolean {
        return !context.authType;
    }

    public async configureBeforePrompt(context: ICreateLinkerContext): Promise<void> {
        if (context.keyVaultAccount) {
            context.authType = { authType: KnownAuthType.SystemAssignedIdentity } // connection string is not supported for key vault
        }
    }
}
