/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';

export interface QuickPickWizardContext<TNode extends unknown> extends types.IActionContext {
    pickedNodes: TNode[];
}

export function getLastNode<TNode extends unknown>(context: QuickPickWizardContext<TNode>): TNode | undefined {
    if (context.pickedNodes.length) {
        return context.pickedNodes[context.pickedNodes.length - 1];
    }

    return undefined;
}
