/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { AppInsightsListStep } from '../src/createAppService/AppInsightsListStep';
import { IAppServiceWizardContext } from '../src/createAppService/IAppServiceWizardContext';

suite("AppInsightsListStep", () => {
    suite("isNameAvailable", () => {
        function createMockContext(existingNames: string[]): IAppServiceWizardContext {
            const components = existingNames.map((name) => ({ name }));
            return {
                appInsightsTask: Promise.resolve(components),
            } as unknown as IAppServiceWizardContext;
        }

        test("should return true when name does not exist", async () => {
            const context = createMockContext(["existing-ai"]);
            const result = await AppInsightsListStep.isNameAvailable(context, "new-ai");
            assert.strictEqual(result, true);
        });

        test("should return false when name already exists", async () => {
            const context = createMockContext(["existing-ai"]);
            const result = await AppInsightsListStep.isNameAvailable(context, "existing-ai");
            assert.strictEqual(result, false);
        });

        test("should be case-insensitive", async () => {
            const context = createMockContext(["MyAppInsights"]);
            const result = await AppInsightsListStep.isNameAvailable(context, "myappinsights");
            assert.strictEqual(result, false);
        });

        test("should return true when no components exist", async () => {
            const context = createMockContext([]);
            const result = await AppInsightsListStep.isNameAvailable(context, "new-ai");
            assert.strictEqual(result, true);
        });
    });
});
