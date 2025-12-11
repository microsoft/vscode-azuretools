/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace dateTimeUtils {
    export function getFormattedDurationInMinutesAndSeconds(durationTime: number, units?: duration.DurationUnitType): string {
        return dayjs
            .duration(durationTime, units)
            .format('m[m] s[s]')
            .replace(/\b0m\b/, '')
            .trim();
    }
}
