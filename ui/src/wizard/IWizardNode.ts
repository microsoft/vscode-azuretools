/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';

/**
 * Simple tree structure to keep track of sub wizards, necessary to execute steps in the correct order.
 */
export interface IWizardNode<T> {
    executeSteps: types.AzureWizardExecuteStep<T>[];
    children: IWizardNode<T>[];
}

/**
 * Use post-order traversal to get all execute steps in correct order.
 */
export function getExecuteSteps<T>(root: IWizardNode<T>): types.AzureWizardExecuteStep<T>[] {
    const steps: types.AzureWizardExecuteStep<T>[] = [];
    let node: IWizardNode<T> | undefined = root;
    const stack: IWizardNode<T>[] = [];
    while (node) {
        if (node.children.length > 0) {
            stack.push(node);
            node = node.children.shift();
        } else {
            steps.push(...node.executeSteps);
            node = stack.pop();
        }
    }

    return steps;
}
