/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from '../..';
import { UserCancelledError } from '../errors';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';

export class NoExecuteStep<T extends IActionContext> extends AzureWizardExecuteStep<T> {
    public priority: number = 200;

    private _key: string = "NoExecute";
    public async execute(_wizardContext: T): Promise<void> {
        throw new UserCancelledError(this._key);
    }

    public shouldExecute(_wizardContext: T): boolean {
        return true;
    }
}
