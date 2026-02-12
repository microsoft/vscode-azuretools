/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { QuickPickWizardContext } from '../types/pickExperience';

export function getLastNode<TNode = unknown>(context: QuickPickWizardContext): TNode | undefined {
    return context.pickedNodes.at(-1) as TNode | undefined;
}
