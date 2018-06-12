/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from 'vscode-azureextensionui';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class SetWizardContextPropertyStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public readonly property: string;
    // tslint:disable-next-line:no-any
    public readonly value: any;
    // tslint:disable-next-line:no-any
    public constructor(property: string, value: any) {
        super();
        this.property = property;
        this.value = value;

    }
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<IAppServiceWizardContext> {
        if (typeof this.value === 'function') {
            wizardContext[this.property] = this.value();
        } else {
            wizardContext[this.property] = this.value;
        }
        return wizardContext;
    }
}
