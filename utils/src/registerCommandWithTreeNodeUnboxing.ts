/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { CommandCallback, IActionContext } from '../index';
import type { Box, TreeNodeCommandCallback } from '../hostapi.v2';
import { registerCommand } from './registerCommand';

export function registerCommandWithTreeNodeUnboxing<T>(commandId: string, treeNodeCallback: TreeNodeCommandCallback<T>, debounce?: number, telemetryId?: string): void {
    const unwrappingCallback: CommandCallback = async (context: IActionContext, ...args: unknown[]) => {
        const maybeNodeBox = args?.[0];
        const maybeNodeBoxArray = args?.[1];
        const remainingArgs = args.slice(2);

        let node: T | undefined;
        if (maybeNodeBox && isBox(maybeNodeBox)) {
            // If the first arg is a box, unwrap it
            node = await maybeNodeBox.unwrap();
        } else if (maybeNodeBox) {
            // Otherwise, assume it is just a T
            node = maybeNodeBox as T;
        }

        let nodes: T[] | undefined;
        if (maybeNodeBoxArray && Array.isArray(maybeNodeBoxArray) && maybeNodeBoxArray.every(n => isBox(n))) {
            // If the first arg is an array of boxes, unwrap them
            const boxedNodes = maybeNodeBoxArray as Box[];
            nodes = [];
            for (const n of boxedNodes) {
                nodes.push(n.unwrap<T>())
            }
        } else if (maybeNodeBoxArray && Array.isArray(maybeNodeBoxArray)) {
            // Otherwise, assume it is just an array of T's
            nodes = maybeNodeBoxArray as T[];
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return treeNodeCallback(context, node, nodes, ...remainingArgs);
    };

    registerCommand(commandId, unwrappingCallback, debounce, telemetryId);
}

export function isBox(maybeBox: unknown): maybeBox is Box {
    if (maybeBox && typeof maybeBox === 'object' &&
        (maybeBox as Box).unwrap && typeof (maybeBox as Box).unwrap === 'function') {
        return true;
    }

    return false;
}
