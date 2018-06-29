/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export abstract class AzureWizardExecuteStep<T> {
    public abstract execute(wizardContext: T): Promise<T>;
}
