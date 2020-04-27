/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import { AzureWizardExecuteStep } from 'vscode-azureextensionui';
import { nonNullProp } from '../../utils/nonNull';
import { AppSettingTreeItem } from '../AppSettingTreeItem';
import { IAppSettingWizardContext } from './IAppSettingWizardContext';

export class AppSettingCreateStep extends AzureWizardExecuteStep<IAppSettingWizardContext> {
    public priority: number = 170;

    public async execute(context: IAppSettingWizardContext): Promise<void> {
        // make a deep copy so settings are not cached if there's a failure
        // tslint:disable-next-line: no-unsafe-any
        const settings: StringDictionary = JSON.parse(JSON.stringify(context.appSettings));
        if (!settings.properties) {
            settings.properties = {};
        }

        const newKey: string = nonNullProp(context, 'newKey');
        const newValue: string = nonNullProp(context, 'newValue');

        settings.properties[newKey] = newValue;

        context.appSettings = await context.appSettingsTreeItem.root.client.updateApplicationSettings(settings);
        context.newChildTreeItem = await AppSettingTreeItem.createAppSettingTreeItem(context.appSettingsTreeItem, newKey, newValue);
    }

    public shouldExecute(context: IAppSettingWizardContext): boolean {
        return !!context.newKey; // todo check value? is empty allowed?
    }
}
