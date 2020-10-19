/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as tas from 'vscode-tas-client';
import { IExperimentationServiceAdapter } from '../index';
import { debugTelemetryEnabled } from './createTelemetryReporter';
import { ext } from './extensionVariables';
import { getPackageInfo } from './getPackageInfo';

export async function registerExperimentationService(ctx: vscode.ExtensionContext, targetPopulation?: tas.TargetPopulation): Promise<void> {
    const result: ExperimentationServiceAdapter = new ExperimentationServiceAdapter();
    const { extensionId, extensionVersion } = getPackageInfo(ctx);

    if (vscode.workspace.getConfiguration('telemetry').get('enableTelemetry', false) && !debugTelemetryEnabled) {
        try {
            result.wrappedExperimentationService = await tas.getExperimentationServiceAsync(
                extensionId,
                extensionVersion,
                targetPopulation ?? (/alpha/ig.test(extensionVersion) ? tas.TargetPopulation.Insiders : tas.TargetPopulation.Public),
                ext._internalReporter,
                ctx.globalState
            );
        } catch {
            // Best effort
        }
    }

    ext.experimentationService = result;
}

class ExperimentationServiceAdapter implements IExperimentationServiceAdapter {
    public wrappedExperimentationService?: tas.IExperimentationService;

    public async isCachedFlightEnabled(flight: string): Promise<boolean> {
        if (!this.wrappedExperimentationService) {
            return false;
        }

        return this.wrappedExperimentationService.isCachedFlightEnabled(flight);
    }

    public async isLiveFlightEnabled(flight: string): Promise<boolean> {
        if (!this.wrappedExperimentationService) {
            return false;
        }

        return this.wrappedExperimentationService.isFlightEnabledAsync(flight);
    }
}
