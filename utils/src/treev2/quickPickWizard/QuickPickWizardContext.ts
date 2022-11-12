/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';

export function getLastNode<TNode = unknown>(context: types.QuickPickWizardContext): TNode | undefined {
    return context.pickedNodes.at(-1) as TNode | undefined;
}
