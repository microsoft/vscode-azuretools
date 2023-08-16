/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ExecuteActivityContext } from "@microsoft/vscode-azext-utils";
import { ICreateLinkerContext } from "../createLinker/ICreateLinkerContext";

export interface IPickLinkerContext extends ICreateLinkerContext, ExecuteActivityContext {
    linkerName?: string;
}

