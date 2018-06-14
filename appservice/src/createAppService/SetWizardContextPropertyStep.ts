/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from 'vscode-azureextensionui';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

/**
 * This step is used to alter the WizardContext's properties without having to recreate the wizard or
 * stop the prompts.  This is neccessary when the value of a property relies on previously prompted
 * steps i.e. the resource group's name relies on the app location so a location must be selected first
 */
export class SetWizardContextPropertyStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public readonly property: string;
    // tslint:disable-next-line:no-any
    public readonly value: any;
    /**
     * @param property The property that is being changed
     * @param value The value that the property will be set to.
     * If the value is a function, the function's returned value will be what it set to the property
     */
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
