/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { validateAppSettingKey } from '../AppSettingsTreeItem';
import { IAppSettingWizardContext } from './IAppSettingWizardContext';

export class AppSettingKeyStep extends AzureWizardPromptStep<IAppSettingWizardContext> {
    public async prompt(context: IAppSettingWizardContext): Promise<void> {
        context.newKey = await ext.ui.showInputBox({
            prompt: 'Enter new setting key',
            validateInput: (v?: string): string | undefined => validateAppSettingKey(context.appSettings, context.appSettingsTreeItem.root.client, v)
        });
        context.newChildLabel = context.newKey;
    }

    public shouldPrompt(context: IAppSettingWizardContext): boolean {
        return !context.newKey;
    }
}
