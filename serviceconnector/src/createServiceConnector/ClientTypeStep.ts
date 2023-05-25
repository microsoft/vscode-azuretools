/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from "@microsoft/vscode-azext-utils";
import { ICreateLinkerContext } from "./ICreateLinkerContext";

export class ClientTypeStep extends AzureWizardPromptStep<ICreateLinkerContext>{
    public async prompt(context: ICreateLinkerContext): Promise<void> {
        const placeHolder = 'Select Language/Framework';
        const picks: IAzureQuickPickItem<string>[] = [
            { label: 'None', data: 'none' },
            { label: '.NET', data: 'dotnet' },
            { label: 'Java', data: 'java' },
            { label: 'Node.js', data: 'nodejs' },
            { label: 'Python', data: 'python' },
            { label: 'Go', data: 'go' },
            { label: 'Ruby', data: 'ruby' },
            { label: 'PHP', data: 'php' },
            { label: 'Django', data: 'django' },
            { label: 'SpringBoot', data: 'springboot' }
        ];

        context.clientType = (await context.ui.showQuickPick(picks, { placeHolder })).data;
    }

    public shouldPrompt(context: ICreateLinkerContext): boolean {
        return !context.clientType;
    }
}
