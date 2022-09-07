/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GenericQuickPickOptions, GenericQuickPickStep } from './GenericQuickPickStep';
import { isAzExtParentTreeItem } from '../../tree/InternalInterfaces';
import { QuickPickWizardContext } from './QuickPickWizardContext';
import { ContextValueFilter, ContextValueFilterableTreeNode, ContextValueFilterableTreeNodeV2 } from '../../../hostapi.v2';

export interface ContextValueFilterQuickPickOptions extends GenericQuickPickOptions {
    contextValueFilter: ContextValueFilter;
}

export class ContextValueQuickPickStep<TNode extends ContextValueFilterableTreeNode, TContext extends QuickPickWizardContext<TNode>, TOptions extends ContextValueFilterQuickPickOptions> extends GenericQuickPickStep<TNode, TContext, TOptions> {
    protected override isDirectPick(node: TNode): boolean {
        const includeOption = this.pickOptions.contextValueFilter.include;
        const excludeOption = this.pickOptions.contextValueFilter.exclude;

        const includeArray: (string | RegExp)[] = Array.isArray(includeOption) ? includeOption : [includeOption];
        const excludeArray: (string | RegExp)[] = excludeOption ?
            (Array.isArray(excludeOption) ? excludeOption : [excludeOption]) :
            [];

        const nodeContextValues: string[] = isContextValueFilterableTreeNodeV2(node) ?
            node.quickPickOptions.contextValues :
            [node.contextValue];

        return includeArray.some(i => this.matchesSingleFilter(i, nodeContextValues)) &&
            !excludeArray.some(e => this.matchesSingleFilter(e, nodeContextValues));
    }

    protected override isIndirectPick(node: TNode): boolean {
        if (isContextValueFilterableTreeNodeV2(node)) {
            return node.quickPickOptions.isLeaf === false;
        } else if (isAzExtParentTreeItem(node)) {
            return true;
        }

        return false;
    }

    private matchesSingleFilter(matcher: string | RegExp, nodeContextValues: string[]): boolean {
        return nodeContextValues.some(c => {
            if (matcher instanceof RegExp) {
                return matcher.test(c);
            }

            // Context value matcher is a string, do full equality (same as old behavior)
            return c === matcher;
        })
    }
}

export function isContextValueFilterableTreeNodeV2(maybeNode: unknown): maybeNode is ContextValueFilterableTreeNodeV2 {
    if (typeof maybeNode === 'object') {
        return Array.isArray((maybeNode as ContextValueFilterableTreeNodeV2).quickPickOptions?.contextValues) &&
            (maybeNode as ContextValueFilterableTreeNodeV2).quickPickOptions?.isLeaf !== undefined &&
            (maybeNode as ContextValueFilterableTreeNodeV2).quickPickOptions?.isLeaf !== null;
    }

    return false;
}
