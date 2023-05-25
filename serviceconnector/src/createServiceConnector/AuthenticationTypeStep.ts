/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { AuthInfoBase } from "@azure/arm-servicelinker";
import { AzureWizardPromptStep, IAzureQuickPickItem } from "@microsoft/vscode-azext-utils";
import { ICreateLinkerContext } from "./ICreateLinkerContext";

export class AuthenticationTypeStep extends AzureWizardPromptStep<ICreateLinkerContext>{
    public async prompt(context: ICreateLinkerContext): Promise<void> {
        const placeHolder = 'Select Authentication Type';
        const picks: IAzureQuickPickItem<AuthInfoBase>[] = [
            { label: 'System assigned managed identity', data: { authType: 'systemAssignedIdentity' } },
            { label: 'User assigned managed identity', data: { authType: 'userAssignedIdentity' } },
            { label: 'Service principal', data: { authType: 'servicePrincipalSecret' } },
            { label: 'Connection string', data: { authType: 'secret' } },
        ];

        context.authType = (await context.ui.showQuickPick(picks, { placeHolder })).data;
    }

    public shouldPrompt(context: ICreateLinkerContext): boolean {
        return !context.authType;
    }
}
