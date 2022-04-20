/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ExecuteActivityContext, IActionContext } from "@microsoft/vscode-azext-utils";
import { ParsedSite } from "../SiteClient";

export interface IDeleteSiteWizardContext extends IActionContext, ExecuteActivityContext {
    site?: ParsedSite;
    deletePlan?: boolean;
}
