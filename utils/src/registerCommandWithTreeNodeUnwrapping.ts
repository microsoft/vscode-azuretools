/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { CommandCallback, IActionContext, Wrapper } from '../index';
import type { TreeNodeCommandCallback } from '../hostapi.v2';
import { registerCommand } from './registerCommand';

export function registerCommandWithTreeNodeUnwrapping<T>(commandId: string, treeNodeCallback: TreeNodeCommandCallback<T>, debounce?: number, telemetryId?: string): void {
    const unwrappingCallback: CommandCallback = async (context: IActionContext, ...args: unknown[]) => {
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return treeNodeCallback(context, node, nodes, ...remainingArgs);
    };

    registerCommand(commandId, unwrappingCallback, debounce, telemetryId);
}

export function isWrapper(maybeWrapper: unknown): maybeWrapper is Wrapper {
    if (maybeWrapper && typeof maybeWrapper === 'object' &&
        (maybeWrapper as Wrapper).unwrap && typeof (maybeWrapper as Wrapper).unwrap === 'function') {
        return true;
    }

    return false;
}
