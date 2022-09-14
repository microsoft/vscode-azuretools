/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../../index';
import { GenericQuickPickOptions, GenericQuickPickStep } from './GenericQuickPickStep';

export interface ContextValueFilterQuickPickOptions extends GenericQuickPickOptions {
    contextValueFilter: types.ContextValueFilter;
}

export class ContextValueQuickPickStep<TNode extends types.ContextValueFilterableTreeNode, TContext extends types.QuickPickWizardContext<TNode>, TOptions extends ContextValueFilterQuickPickOptions> extends GenericQuickPickStep<TNode, TContext, TOptions> {
    protected override isDirectPick(node: TNode): boolean {
        const includeOption = this.pickOptions.contextValueFilter.include;
        const excludeOption = this.pickOptions.contextValueFilter.exclude;

        const includeArray: (string | RegExp)[] = Array.isArray(includeOption) ? includeOption : [includeOption];
        const excludeArray: (string | RegExp)[] = excludeOption ?
            (Array.isArray(excludeOption) ? excludeOption : [excludeOption]) :
            [];

        const nodeContextValues: string[] = node.quickPickOptions.contextValues;

        return includeArray.some(i => this.matchesSingleFilter(i, nodeContextValues)) &&
            !excludeArray.some(e => this.matchesSingleFilter(e, nodeContextValues));
    }

    protected override isIndirectPick(node: TNode): boolean {
        return node.quickPickOptions.isLeaf === false;
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

export function isContextValueFilterableTreeNodeV2(maybeNode: unknown): maybeNode is types.ContextValueFilterableTreeNodeV2 {
    if (typeof maybeNode === 'object') {
        return Array.isArray((maybeNode as types.ContextValueFilterableTreeNodeV2).quickPickOptions?.contextValues) &&
            (maybeNode as types.ContextValueFilterableTreeNodeV2).quickPickOptions?.isLeaf !== undefined &&
            (maybeNode as types.ContextValueFilterableTreeNodeV2).quickPickOptions?.isLeaf !== null;
    }

    return false;
}
