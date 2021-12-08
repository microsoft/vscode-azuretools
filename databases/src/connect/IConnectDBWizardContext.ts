/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICosmosDBWizardContext } from '../create/CosmosDBAccountWizard/ICosmosDBWizardContext';
import { IPostgresServerWizardContext } from '../create/PostgresAccountWizard/IPostgresServerWizardContext';
import { DBTreeItem } from './DBTreeItem';

export interface IConnectDBWizardContext extends IPostgresServerWizardContext, ICosmosDBWizardContext {

    addDBConnectionSkip?: boolean;
    createDBAccount?: boolean;
    databaseConnectionTreeItem?: DBTreeItem;
    databaseName?: string;
    databaseAccountName?: string;
    createNewDatabase?: boolean;
}
