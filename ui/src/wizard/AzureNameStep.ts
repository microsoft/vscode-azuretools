/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isArray } from "util";
import { IAzureNamingRules, IRelatedNameWizardContext } from "../../index";
import { AzureWizardStep } from "./AzureWizardStep";

export abstract class AzureNameStep<T extends IRelatedNameWizardContext> extends AzureWizardStep<T> {
    protected abstract isRelatedNameAvailable(wizardContext: T, name: string): Promise<boolean>;

    protected async generateRelatedName(wizardContext: T, name: string, namingRules: IAzureNamingRules | IAzureNamingRules[]): Promise<string | undefined> {
        if (!isArray(namingRules)) {
            namingRules = [namingRules];
        }

        let preferredName: string = namingRules.some((n: IAzureNamingRules) => !!n.lowercaseOnly) ? name.toLowerCase() : name;

        for (const invalidCharsRegExp of namingRules.map((n: IAzureNamingRules) => n.invalidCharsRegExp)) {
            preferredName = preferredName.replace(invalidCharsRegExp, '');
        }

        const minLength: number = Math.max(...namingRules.map((n: IAzureNamingRules) => n.minLength));
        const maxLength: number = Math.min(...namingRules.map((n: IAzureNamingRules) => n.maxLength));

        const maxTries: number = 100;
        let count: number = 1;
        let newName: string;
        while (count < maxTries) {
            newName = this.generateSuffixedName(preferredName, count, minLength, maxLength);
            if (await this.isRelatedNameAvailable(wizardContext, newName)) {
                return newName;
            }
            count += 1;
        }

        return undefined;
    }

    private generateSuffixedName(preferredName: string, i: number, minLength: number, maxLength: number): string {
        const suffix: string = i === 1 ? '' : i.toString();
        const minUnsuffixedLength: number = minLength - suffix.length;
        const maxUnsuffixedLength: number = maxLength - suffix.length;

        let unsuffixedName: string = preferredName;
        if (unsuffixedName.length > maxUnsuffixedLength) {
            unsuffixedName = preferredName.slice(0, maxUnsuffixedLength);
        } else {
            while (unsuffixedName.length < minUnsuffixedLength) {
                unsuffixedName += preferredName;
            }
        }

        return unsuffixedName + suffix;
    }
}
