/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { AzureWizardPromptStep, nonNullValue, randomUtils } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { ICreateLinkerContext } from './ICreateLinkerContext';

export class LinkerNameStep extends AzureWizardPromptStep<ICreateLinkerContext>{
    public async prompt(context: ICreateLinkerContext): Promise<void> {
        context.linkerName = await context.ui.showInputBox({
            prompt: vscode.l10n.t('Enter a name for the connection'),
            value: nonNullValue(context.targetServiceType?.name) + '_' + randomUtils.getRandomHexString(5),
            validateInput: this.validateInput
        });
    }

    public shouldPrompt(context: ICreateLinkerContext): boolean {
        return !context.linkerName;
    }

    private validateInput(name: string | undefined) {
        name = name ? name.trim() : '';

        if (!/^[a-z][a-zA-Z0-9_.]*$/.test(name)) {
            return vscode.l10n.t(`Connection names can only consist of alphanumeric characters, periods ('.'), or underscores ('_').`);
        }
        return undefined;
    }
}
