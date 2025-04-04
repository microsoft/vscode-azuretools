/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dayjs from 'dayjs';
// eslint-disable-next-line import/no-internal-modules
import * as duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export namespace dateTimeUtils {
    export function getFormattedDurationInMinutesAndSeconds(time: number, unit?: duration.DurationUnitType): string {
        return dayjs
            .duration(time, unit)
            .format('m[m] s[s]')
            .replace(/\b0m\b/, '')
            .trim();
    }
}
