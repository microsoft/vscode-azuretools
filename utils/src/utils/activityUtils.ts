/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { ActivityChildType } from '../../index';

export function insertAfterLastInfoChild(context: Partial<types.ExecuteActivityContext>, infoChild: types.ActivityInfoChild): void {
    if (!context.activityChildren) {
        return;
    }

    const idx: number = context.activityChildren
        .map(child => child.activityType)
        .lastIndexOf(ActivityChildType.Info);

    if (idx === -1) {
        context.activityChildren.unshift(infoChild);
    } else {
        context.activityChildren.splice(idx + 1, 0, infoChild);
    }
}
