/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan, SiteConfigResource } from "@azure/arm-appservice";
import { ActivityChildItem, ActivityChildType, activityFailContext, activityFailIcon, activityProgressContext, activityProgressIcon, activitySuccessContext, activitySuccessIcon, AzureWizardExecuteStep, createContextValue, ExecuteActivityOutput, randomUtils } from "@microsoft/vscode-azext-utils";
import { l10n, Progress } from "vscode";
import { InnerDeployContext } from "../IDeployContext";

export abstract class DeployExecuteStepBase extends AzureWizardExecuteStep<InnerDeployContext> {
    stepName: string = 'DeployExecuteStepBase';
    public createSuccessOutput(context: InnerDeployContext): ExecuteActivityOutput {
        return {
            item: new ActivityChildItem({
                contextValue: createContextValue([activitySuccessContext, context.site.id]),
                label: l10n.t('Zip and deploy workspace "{0}"', context.effectiveDeployFsPath),
                iconPath: activitySuccessIcon,
                activityType: ActivityChildType.Success,
            })
        };
    }
    public createProgressOutput(context: InnerDeployContext): ExecuteActivityOutput {
        return {
            item: new ActivityChildItem({
                contextValue: createContextValue([activityProgressContext, context.site.id]),
                label: l10n.t('Zip and deploy workspace "{0}"', context.effectiveDeployFsPath),
                iconPath: activityProgressIcon,
                activityType: ActivityChildType.Progress,
            })
        };
    }
    public createFailOutput(context: InnerDeployContext): ExecuteActivityOutput {
        return {
            item: new ActivityChildItem({
                contextValue: createContextValue([activityFailContext, context.site.id]),
                label: l10n.t('Zip and deploy workspace "{0}"', context.effectiveDeployFsPath),
                iconPath: activityFailIcon,
                activityType: ActivityChildType.Fail,
            })
        };
    }

    public priority: number = 200;
    protected progress: Progress<{ message?: string; increment?: number }> | undefined;
    public constructor() {
        super();
    }

    public async execute(context: InnerDeployContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const client = context.client;
        this.progress = progress;
        const config: SiteConfigResource = await client.getSiteConfig();
        const startingDeployment = l10n.t('Starting deployment...')
        progress.report({ message: startingDeployment });
        // We use the AppServicePlan in a few places, but we don't want to delay deployment, so start the promise now and save as a const
        try {
            await setDeploymentTelemetry(context, config, context.aspPromise);
        } catch (error) {
            // Ignore
        }
        await this.deployCore(context, config);
    }

    public shouldExecute(_context: InnerDeployContext): boolean {
        return true;
    }

    public abstract deployCore(context: InnerDeployContext, config: SiteConfigResource): Promise<void>;
}

function getLinuxFxVersionForTelemetry(config: SiteConfigResource): string {
    const linuxFxVersion = config.linuxFxVersion || '';
    // Docker values point to the user's specific image, which we don't want to track
    return /^docker/i.test(linuxFxVersion) ? 'docker' : linuxFxVersion;
}

async function setDeploymentTelemetry(context: InnerDeployContext, config: SiteConfigResource, aspPromise: Promise<AppServicePlan | undefined>): Promise<void> {
    context.telemetry.properties.sourceHash = await randomUtils.getPseudononymousStringHash(context.fsPath);
    context.telemetry.properties.destHash = await randomUtils.getPseudononymousStringHash(context.site.fullName);
    context.telemetry.properties.scmType = String(config.scmType);
    context.telemetry.properties.isSlot = context.site.isSlot ? 'true' : 'false';
    context.telemetry.properties.alwaysOn = config.alwaysOn ? 'true' : 'false';
    context.telemetry.properties.linuxFxVersion = getLinuxFxVersionForTelemetry(config);
    context.telemetry.properties.nodeVersion = String(config.nodeVersion);
    context.telemetry.properties.pythonVersion = String(config.pythonVersion);
    context.telemetry.properties.hasCors = config.cors ? 'true' : 'false';
    context.telemetry.properties.hasIpSecurityRestrictions = config.ipSecurityRestrictions && config.ipSecurityRestrictions.length > 0 ? 'true' : 'false';
    context.telemetry.properties.javaVersion = String(config.javaVersion);
    context.telemetry.properties.siteKind = context.site.kind;
    context.client.getState().then(
        (state: string) => {
            context.telemetry.properties.state = state;
        },
        () => {
            // ignore
        });
    aspPromise.then(
        (plan: AppServicePlan | undefined) => {
            if (plan) {
                context.telemetry.properties.planStatus = String(plan.status);
                context.telemetry.properties.planKind = String(plan.kind);
                if (plan.sku) {
                    context.telemetry.properties.planSize = String(plan.sku.size);
                    context.telemetry.properties.planTier = String(plan.sku.tier);
                }
            }
        },
        () => {
            // ignore
        });
}
