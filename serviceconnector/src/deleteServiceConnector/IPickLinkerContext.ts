/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ICreateLinkerContext } from "../createServiceConnector/ICreateLinkerContext";

//also used for validate maybe make more generic and put in another folder?
export interface IPickLinkerContext extends ICreateLinkerContext {
    linkerName?: string;
}

