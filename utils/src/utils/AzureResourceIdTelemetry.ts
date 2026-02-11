/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { TelemetryTrustedValue } from "vscode";
import { IActionContext } from "../..";

/**
 * Verifies that the given resourceId is a valid Azure resource ID and sets telemetry properties for the resourceId as a TrustedTelemetryValue property.
 * @param context The action context
 * @param resourceId The resource ID to set telemetry properties for
 */
export function setAzureResourceIdTelemetryProperties(context: IActionContext, resourceId: string): void {
    if (isAzureResourceId(resourceId)) {
        context.telemetry.properties.resourceId = new TelemetryTrustedValue(resourceId);
    }
}

function isAzureResourceId(value: string): boolean {
    // this is a very basic check, only ensuring /subscriptions/GUID, but it should be enough for telemetry purposes
    return /^\/subscriptions\/[0-9a-fA-F-]{36}\//.test(value);
}
