/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationStack } from 'azure-arm-website/lib/models';
import { AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { requestUtils } from '../utils/requestUtils';
import { AppKind, LinuxRuntimes, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

type ApplicationStackJsonResponse = {
    value: [{
        properties: ApplicationStack
    }]
};

export class SiteRuntimeStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        if (wizardContext.newSiteKind === AppKind.functionapp) {
            const runtimeItems: IAzureQuickPickItem<string>[] = [
                { label: 'JavaScript', data: 'node' },
                { label: '.NET', data: 'dotnet' }
            ];

            const previewDescription: string = localize('previewDescription', '(Preview)');
            if (wizardContext.newSiteOS === WebsiteOS.linux) {
                runtimeItems.push({ label: 'Python', description: previewDescription, data: 'python' });
            } else {
                runtimeItems.push({ label: 'Java', data: 'java' });
                runtimeItems.push({ label: 'PowerShell', description: previewDescription, data: 'powershell' });
            }

            wizardContext.newSiteRuntime = (await ext.ui.showQuickPick(runtimeItems, { placeHolder: 'Select a runtime for your new app.' })).data;
        } else if (wizardContext.newSiteOS === WebsiteOS.linux) {
            wizardContext.newSiteRuntime = (await ext.ui.showQuickPick(
                this.getLinuxRuntimeStack(wizardContext).then(stacks => convertStacksToPicks(stacks, wizardContext.recommendedSiteRuntime)),
                { placeHolder: 'Select a runtime for your new Linux app.' })
            ).data;
        }
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.newSiteRuntime && !(wizardContext.newSiteKind === AppKind.app && wizardContext.newSiteOS === WebsiteOS.windows);
    }

    // the sdk has a bug that doesn't retrieve the full response for provider.getAvailableStacks(): https://github.com/Azure/azure-sdk-for-node/issues/5068
    private async getLinuxRuntimeStack(wizardContext: IAppServiceWizardContext): Promise<ApplicationStack[]> {
        const urlPath: string = 'providers/Microsoft.Web/availableStacks?osTypeSelected=Linux&api-version=2018-02-01';
        const requestOptions: requestUtils.Request = await requestUtils.getDefaultAzureRequest(urlPath, wizardContext);
        const runtimes: string = await requestUtils.sendRequest(requestOptions);
        return (<ApplicationStackJsonResponse>JSON.parse(runtimes)).value.map(v => v.properties);
    }
}

export function convertStacksToPicks(stacks: ApplicationStack[], recommendedRuntimes: LinuxRuntimes[] | undefined): IAzureQuickPickItem<string>[] {
    function getPriority(data: string): number {
        // tslint:disable-next-line: strict-boolean-expressions
        recommendedRuntimes = recommendedRuntimes || [];
        const index: number = recommendedRuntimes.findIndex(r => r === data.toLowerCase());
        return index === -1 ? recommendedRuntimes.length : index;
    }

    return stacks
        // convert each "majorVersion" to an object with all the info we need
        // tslint:disable-next-line: strict-boolean-expressions
        .map(stack => (stack.majorVersions || []).map(mv => {
            return {
                runtimeVersion: nonNullProp(mv, 'runtimeVersion'),
                displayVersion: nonNullProp(mv, 'displayVersion'),
                stackDisplay: nonNullProp(stack, 'display')
            };
        }))
        // flatten array
        .reduce((acc, val) => acc.concat(val))
        // filter out Node 4.x and 6.x as they are EOL
        .filter(mv => !/node\|(4|6)\./i.test(mv.runtimeVersion))
        // sort
        .sort((a, b) => {
            const aInfo: IParsedRuntimeVersion = getRuntimeInfo(a.runtimeVersion);
            const bInfo: IParsedRuntimeVersion = getRuntimeInfo(b.runtimeVersion);
            if (aInfo.name !== bInfo.name) {
                const result: number = getPriority(aInfo.name) - getPriority(bInfo.name);
                if (result !== 0) {
                    return result;
                }
            } else if (aInfo.major !== bInfo.major) {
                return bInfo.major - aInfo.major;
            } else if (aInfo.minor !== bInfo.minor) {
                return bInfo.minor - aInfo.minor;
            }

            if (a.displayVersion !== b.displayVersion) {
                return a.displayVersion.localeCompare(b.displayVersion);
            } else {
                return a.stackDisplay.localeCompare(b.stackDisplay);
            }
        })
        // convert to quick pick
        .map(mv => {
            return {
                id: mv.runtimeVersion,
                label: mv.displayVersion,
                data: mv.runtimeVersion,
                // include stack as description if it has a version
                // tslint:disable-next-line: strict-boolean-expressions
                description: /[0-9]/.test(mv.stackDisplay) ? mv.stackDisplay : undefined
            };
        });
}

interface IParsedRuntimeVersion {
    name: string;
    major: number;
    minor: number;
}

function getRuntimeInfo(runtimeVersion: string): IParsedRuntimeVersion {
    const parts: string[] = runtimeVersion.split('|');

    let major: string | undefined;
    let minor: string | undefined;
    if (parts[1]) {
        const match: RegExpMatchArray | null = parts[1].match(/([0-9]+)(?:\.([0-9]+))?/);
        if (match) {
            major = match[1];
            minor = match[2];
        }
    }

    return {
        name: parts[0],
        major: convertToNumber(major),
        minor: convertToNumber(minor)
    };
}

function convertToNumber(data: string | undefined): number {
    if (data) {
        const result: number = parseInt(data);
        if (!isNaN(result)) {
            return result;
        }
    }
    return Number.MAX_SAFE_INTEGER;
}
