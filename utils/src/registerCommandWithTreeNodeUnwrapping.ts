/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { IActionContext, Wrapper, TreeNodeCommandCallback } from '../index';
import { registerCommand } from './registerCommand';

export function registerCommandWithTreeNodeUnwrapping<T>(commandId: string, treeNodeCallback: TreeNodeCommandCallback<T>, debounce?: number, telemetryId?: string): void {
    registerCommand(commandId, unwrapArgs(treeNodeCallback), debounce, telemetryId);
}

export function unwrapArgs<T>(treeNodeCallback: TreeNodeCommandCallback<T>): TreeNodeCommandCallback<T> {
    return async (context: IActionContext, ...args: unknown[]) => {
        const maybeNodeWrapper = args?.[0];
        const maybeNodeWrapperArray = args?.[1];
        const remainingArgs = args.slice(2);

        let node: T | undefined;
        if (maybeNodeWrapper && isWrapper(maybeNodeWrapper)) {
            // If the first arg is a wrapper, unwrap it
            node = await maybeNodeWrapper.unwrap();
        } else if (maybeNodeWrapper) {
            // Otherwise, assume it is just a T
            node = maybeNodeWrapper as T;
        }

        let nodes: T[] | undefined;
        if (maybeNodeWrapperArray && Array.isArray(maybeNodeWrapperArray) && maybeNodeWrapperArray.every(n => isWrapper(n))) {
            // If the first arg is an array of wrappers, unwrap them
            const wrappedNodes = maybeNodeWrapperArray as Wrapper[];
            nodes = [];
            for (const n of wrappedNodes) {
                nodes.push(n.unwrap<T>())
            }
        } else if (maybeNodeWrapperArray && Array.isArray(maybeNodeWrapperArray)) {
            // Otherwise, assume it is just an array of T's
            nodes = maybeNodeWrapperArray as T[];
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return treeNodeCallback(context, node, nodes, ...remainingArgs);
    };
}

export function isWrapper(maybeWrapper: unknown): maybeWrapper is Wrapper {
    if (maybeWrapper && typeof maybeWrapper === 'object' &&
        (maybeWrapper as Wrapper).unwrap && typeof (maybeWrapper as Wrapper).unwrap === 'function') {
        return true;
    }

    return false;
}
