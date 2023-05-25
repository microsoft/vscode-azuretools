/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { AzureWizardPromptStep, nonNullValue, randomUtils } from '@microsoft/vscode-azext-utils';
import { localize } from '../localize';
import { ICreateLinkerContext } from './ICreateLinkerContext';

export class LinkerNameStep extends AzureWizardPromptStep<ICreateLinkerContext>{
    public async prompt(context: ICreateLinkerContext): Promise<void> {
        context.linkerName = await context.ui.showInputBox({
            prompt: localize('imageNamePrompt', 'Enter a name for the connection'),
            value: nonNullValue(context.serviceType?.name) + '_' + randomUtils.getRandomHexString(5),
        });
    }

    public shouldPrompt(context: ICreateLinkerContext): boolean {
        return !context.linkerName;
    }
}
