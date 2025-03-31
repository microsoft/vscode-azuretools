/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as types from '../../index';

export function insertActivityChildDuringProgress(context: types.ExecuteActivityContext, activityChild: types.AzExtTreeItem | types.AzExtParentTreeItem): void {
    if (!context.activityChildren) {
        return;
    }
    context.activityChildren.splice(context.activityChildren.length - 1, 0, activityChild);
    context.reportActivityProgress?.();
}
