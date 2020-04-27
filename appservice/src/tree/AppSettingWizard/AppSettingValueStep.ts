/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { IAppSettingWizardContext } from './IAppSettingWizardContext';

export class AppSettingValueStep extends AzureWizardPromptStep<IAppSettingWizardContext> {
    public async prompt(context: IAppSettingWizardContext): Promise<void> {
        context.newValue = await ext.ui.showInputBox({
            prompt: localize('enterValue', 'Enter setting value for "{0}".', context.newKey)
        });
    }

    public shouldPrompt(context: IAppSettingWizardContext): boolean {
        return !context.newValue;
    }
}
