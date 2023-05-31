/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { AuthInfoBase, KnownAuthType } from "@azure/arm-servicelinker";
import { AzureWizardPromptStep, IAzureQuickPickItem } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { ICreateLinkerContext } from "./ICreateLinkerContext";

export class AuthenticationTypeStep extends AzureWizardPromptStep<ICreateLinkerContext>{
    public async prompt(context: ICreateLinkerContext): Promise<void> {
        const authInfoLabels: string[] = [
            vscode.l10n.t('System assigned managed identity'),
            vscode.l10n.t('User assigned managed identity'),
            vscode.l10n.t('Service principal'),
            vscode.l10n.t('Connection string')
        ];

        const placeHolder = vscode.l10n.t('Select Authentication Type');
        const picks: IAzureQuickPickItem<AuthInfoBase>[] = [
            { label: authInfoLabels[0], data: { authType: KnownAuthType.SystemAssignedIdentity } },
            { label: authInfoLabels[1], data: { authType: KnownAuthType.UserAssignedIdentity } },
            { label: authInfoLabels[2], data: { authType: KnownAuthType.ServicePrincipalSecret } },
            { label: authInfoLabels[3], data: { authType: KnownAuthType.Secret } },
        ];

        context.authType = (await context.ui.showQuickPick(picks, { placeHolder })).data;
    }

    public shouldPrompt(context: ICreateLinkerContext): boolean {
        return !context.authType;
    }
}
