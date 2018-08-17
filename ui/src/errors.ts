/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TelemetryProperties } from "..";
import { localize } from "./localize";

export interface IHasTelemetryProperties {
    telemetryProperties?: Partial<TelemetryProperties>;
}

export class UserCancelledError extends Error implements IHasTelemetryProperties {
    public telemetryProperties?: Partial<TelemetryProperties>;

    constructor(telemetryProperties?: Partial<TelemetryProperties>) {
        super(localize('userCancelledError', 'Operation cancelled.'));
        this.telemetryProperties = telemetryProperties;
    }
}

export class NotImplementedError extends Error {
    constructor(methodName: string, obj: object) {
        super(localize('notImplementedError', '"{0}" is not implemented on "{1}".', methodName, obj.constructor.name));
    }
}

export class ArgumentError extends Error {
    constructor(obj: object) {
        super(localize('argumentError', 'Invalid {0}.', obj.constructor.name));
    }
}

export function addTelemetryToError(error: Error | IHasTelemetryProperties, telemetryProperties: Partial<TelemetryProperties>): IHasTelemetryProperties {
    const referenceToErrorWithTelemetry: IHasTelemetryProperties = <IHasTelemetryProperties>error;

    referenceToErrorWithTelemetry.telemetryProperties = referenceToErrorWithTelemetry.telemetryProperties || <TelemetryProperties>{};
    Object.assign(referenceToErrorWithTelemetry.telemetryProperties, telemetryProperties);

    // Returns the same, modified object
    return referenceToErrorWithTelemetry;
}
