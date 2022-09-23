/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';

export function getLastNode<TNode = unknown>(context: types.QuickPickWizardContext): TNode | undefined {
    if (context.pickedNodes.length) {
        return context.pickedNodes[context.pickedNodes.length - 1] as TNode;
    }

    return undefined;
}
