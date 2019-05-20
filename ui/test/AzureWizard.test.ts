/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as types from '../index';
import { AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, TestInput, TestUserInput } from '../src';
import { ext } from '../src/extensionVariables';

// tslint:disable: max-classes-per-file

interface ITestWizardContext extends types.IActionContext {
    [key: string]: {} | boolean | string | undefined;
}

abstract class QuickPickStepBase extends AzureWizardPromptStep<ITestWizardContext> {
    protected abstract key: string;
    public async prompt(wizardContext: ITestWizardContext): Promise<void> {
        wizardContext[this.key] = (await ext.ui.showQuickPick(
            [
                { label: 'Pick 1' },
                { label: 'Pick 2' },
                { label: 'Pick 3' }
            ],
            {}
        )).label;
    }

    public shouldPrompt(wizardContext: ITestWizardContext): boolean {
        return !wizardContext[this.key];
    }
}

const quickPick1Key: string = 'quickPick1';
class QuickPickStep1 extends QuickPickStepBase {
    protected key: string = quickPick1Key;
}

class QuickPickStep2 extends QuickPickStepBase {
    protected key: string = 'quickPick2';
}

class InputBoxStepIfNotPick1 extends AzureWizardPromptStep<ITestWizardContext> {
    private _key: string = 'inputBoxNotPick1';
    public async prompt(wizardContext: ITestWizardContext): Promise<void> {
        wizardContext[this._key] = await ext.ui.showInputBox({});
    }

    public shouldPrompt(wizardContext: ITestWizardContext): boolean {
        return !wizardContext[this._key] && wizardContext[quickPick1Key] !== 'Pick 1';
    }
}

abstract class InputBoxStepBase extends AzureWizardPromptStep<ITestWizardContext> {
    protected abstract key: string;
    public async prompt(wizardContext: ITestWizardContext): Promise<void> {
        wizardContext[this.key] = await ext.ui.showInputBox({});
    }

    public shouldPrompt(wizardContext: ITestWizardContext): boolean {
        return !wizardContext[this.key];
    }
}

class InputBoxStep1 extends InputBoxStepBase {
    protected key: string = 'inputBox1';
}

class InputBoxStep2 extends InputBoxStepBase {
    protected key: string = 'inputBox2';
}

class SubInputBoxStep extends InputBoxStepBase {
    protected key: string = 'subInputBox';
}

const executeKey2: string = 'execute2';
class ExecuteStep2 extends AzureWizardExecuteStep<ITestWizardContext> {
    public priority: number = 200;

    private _key: string = executeKey2;
    public async execute(wizardContext: ITestWizardContext): Promise<void> {
        wizardContext[this._key] = 'executeValue2';
    }

    public shouldExecute(wizardContext: ITestWizardContext): boolean {
        return !wizardContext[this._key];
    }
}

const executeKey1: string = 'execute1';
class ExecuteStep1 extends AzureWizardExecuteStep<ITestWizardContext> {
    public priority: number = 100;

    private _key: string = executeKey1;
    public async execute(wizardContext: ITestWizardContext): Promise<void> {
        if (wizardContext[executeKey2]) {
            assert.fail('ExecuteStep1 should be executed before ExecuteStep2');
        } else if (wizardContext[this._key]) {
            assert.fail('ExecuteStep1 should not be executed multiple times.');
        }

        wizardContext[this._key] = 'executeValue1';
    }

    public shouldExecute(wizardContext: ITestWizardContext): boolean {
        return !wizardContext[this._key];
    }
}

const subExecuteKey: string = 'subExecute';
class SubExecuteStep extends AzureWizardExecuteStep<ITestWizardContext> {
    public priority: number = 50;

    private _key: string = subExecuteKey;
    public async execute(wizardContext: ITestWizardContext): Promise<void> {
        if (wizardContext[executeKey1] || wizardContext[executeKey2]) {
            assert.fail('SubExecuteStep should be executed before ExecuteStep1 or ExecuteStep2');
        }

        wizardContext[this._key] = 'subExecuteValue';
    }

    public shouldExecute(wizardContext: ITestWizardContext): boolean {
        return !wizardContext[this._key];
    }
}

class SubSubExecuteStep extends AzureWizardExecuteStep<ITestWizardContext> {
    public priority: number = 25;

    private _key: string = 'subSubExecute';
    public async execute(wizardContext: ITestWizardContext): Promise<void> {
        if (wizardContext[executeKey1] || wizardContext[executeKey2] || wizardContext[subExecuteKey]) {
            assert.fail('SubSubExecuteStep should be executed before ExecuteStep1, ExecuteStep2, and SubExecuteStep');
        }

        wizardContext[this._key] = 'subSubExecuteValue';
    }

    public shouldExecute(wizardContext: ITestWizardContext): boolean {
        return !wizardContext[this._key];
    }
}

abstract class QuickPickStepWithSubWizardBase extends QuickPickStepBase {
    public async prompt(wizardContext: ITestWizardContext): Promise<void> {
        const result: string = (await ext.ui.showQuickPick(
            [
                { label: 'Create' },
                { label: 'Pick 1' },
                { label: 'Pick 2' },
                { label: 'Pick 3' }
            ],
            {}
        )).label;

        if (result !== 'Create') {
            wizardContext[this.key] = result;
        }
    }

    public async getSubWizard(wizardContext: ITestWizardContext): Promise<types.IWizardOptions<ITestWizardContext> | undefined> {
        if (!wizardContext[this.key]) {
            return this.getSubWizardInternal();
        } else {
            return undefined;
        }
    }

    protected abstract getSubWizardInternal(): types.IWizardOptions<ITestWizardContext>;
}

class QuickPickStepWithSubWizard extends QuickPickStepWithSubWizardBase {
    protected key: string = 'subQuickPick';
    private _executeStep: AzureWizardExecuteStep<ITestWizardContext>;
    constructor(executeStep?: AzureWizardExecuteStep<ITestWizardContext>) {
        super();
        // tslint:disable-next-line: strict-boolean-expressions
        this._executeStep = executeStep || new SubExecuteStep();
    }
    protected getSubWizardInternal(): types.IWizardOptions<ITestWizardContext> {
        return {
            promptSteps: [new SubInputBoxStep()],
            executeSteps: [this._executeStep]
        };
    }
}

class QuickPickStepWithMultiStepSubWizard extends QuickPickStepWithSubWizardBase {
    protected key: string = 'subQuickPickMulti';
    protected getSubWizardInternal(): types.IWizardOptions<ITestWizardContext> {
        return {
            promptSteps: [new SubInputBoxStep(), new InputBoxStep2(), new QuickPickStep2()],
            executeSteps: [new ExecuteStep1(), new ExecuteStep2()]
        };
    }
}

class QuickPickStepWithSubSubWizard extends QuickPickStepWithSubWizardBase {
    protected key: string = 'subSubQuickPick';
    protected getSubWizardInternal(): types.IWizardOptions<ITestWizardContext> {
        return {
            promptSteps: [new QuickPickStepWithSubWizard()]
        };
    }
}

class QuickPickStepWithSubSubExecute extends QuickPickStepWithSubWizardBase {
    protected key: string = 'subSubQuickPickExecute';
    protected getSubWizardInternal(): types.IWizardOptions<ITestWizardContext> {
        return {
            promptSteps: [new QuickPickStepWithSubWizard(new SubSubExecuteStep())],
            executeSteps: [new SubExecuteStep()]
        };
    }
}

class QuickPickStepSubWizardNoExecute extends AzureWizardPromptStep<ITestWizardContext> {
    private _key: string = 'subQuickPickNoExecute';
    public async prompt(wizardContext: ITestWizardContext): Promise<void> {
        const result: string = (await ext.ui.showQuickPick(
            [
                { label: 'Pick 1' },
                { label: 'Pick 2' },
                { label: 'Pick 3' }
            ],
            {}
        )).label;

        wizardContext[this._key] = result;

    }

    public async getSubWizard(_wizardContext: ITestWizardContext): Promise<types.IWizardOptions<ITestWizardContext> | undefined> {
        return {
            promptSteps: [new SubInputBoxStep()]
        };
    }

    public shouldPrompt(wizardContext: ITestWizardContext): boolean {
        return !wizardContext[this._key];
    }
}

class StepWithSubWizardAndNoPrompt extends AzureWizardPromptStep<ITestWizardContext> {
    public async prompt(): Promise<void> {
        // ignore
    }

    public shouldPrompt(): boolean {
        return false;
    }

    public async getSubWizard(): Promise<types.IWizardOptions<ITestWizardContext>> {
        return {
            executeSteps: [new SubExecuteStep()]
        };
    }
}

async function validateWizard(options: types.IWizardOptions<ITestWizardContext>, inputs: (string | TestInput)[], expectedContext: Partial<ITestWizardContext>): Promise<void> {
    const context: ITestWizardContext = { telemetry: { properties: {}, measurements: {} }, errorHandling: {} };
    // copy over properties/measurements
    Object.assign(expectedContext, context);

    const wizard: AzureWizard<ITestWizardContext> = new AzureWizard(context, options);
    ext.ui = new TestUserInput(inputs);
    await wizard.prompt();
    await wizard.execute();
    assert.deepEqual(context, expectedContext);
    assert.equal(inputs.length, 0, 'Not all inputs were used.');
}

// tslint:disable-next-line: max-func-body-length
suite("AzureWizard tests", () => {
    test("QuickPick", async () => {
        await validateWizard(
            {
                promptSteps: [new QuickPickStep1()],
                executeSteps: [new ExecuteStep1()]
            },
            ['Pick 1'],
            { quickPick1: 'Pick 1', execute1: 'executeValue1' }
        );
    });

    test("InputBox", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue'],
            { inputBox1: 'testValue', execute1: 'executeValue1' }
        );
    });

    test("Execute in order", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1()],
                executeSteps: [new ExecuteStep1(), new ExecuteStep2()]
            },
            ['testValue'],
            { inputBox1: 'testValue', execute1: 'executeValue1', execute2: 'executeValue2' }
        );
    });

    test("QuickPick back", async () => {
        await validateWizard(
            {
                promptSteps: [new QuickPickStep1(), new QuickPickStep2()],
                executeSteps: [new ExecuteStep1()]
            },
            ['Pick 1', TestInput.BackButton, 'Pick 2', 'Pick 3'],
            { quickPick1: 'Pick 2', quickPick2: 'Pick 3', execute1: 'executeValue1' }
        );
    });

    test("InputBox back", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new InputBoxStep2()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', TestInput.BackButton, 'testValueChanged', 'testValue3'],
            { inputBox1: 'testValueChanged', inputBox2: 'testValue3', execute1: 'executeValue1' }
        );
    });

    test("InputBox duplicate step back", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new InputBoxStep1(), new InputBoxStep2()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', TestInput.BackButton, 'testValueChanged', 'testValue3'],
            { inputBox1: 'testValueChanged', inputBox2: 'testValue3', execute1: 'executeValue1' }
        );
    });

    test("Duplicate execute step", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1()],
                executeSteps: [new ExecuteStep1(), new ExecuteStep1()]
            },
            ['testValue'],
            { inputBox1: 'testValue', execute1: 'executeValue1' }
        );
    });

    test("Double back", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new InputBoxStep2()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', TestInput.BackButton, 'testValueChanged', TestInput.BackButton, 'testValueChanged2', 'testValue3'],
            { inputBox1: 'testValueChanged2', inputBox2: 'testValue3', execute1: 'executeValue1' }
        );
    });

    test("SubWizard", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepWithSubWizard()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Create', 'testValue2'],
            { inputBox1: 'testValue', subInputBox: 'testValue2', execute1: 'executeValue1', subExecute: 'subExecuteValue' }
        );
    });

    test("SubWizard double back", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepWithSubWizard(), new InputBoxStep2()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Create', TestInput.BackButton, 'Pick 1', TestInput.BackButton, 'Pick 1', 'testValue2'],
            { inputBox1: 'testValue', subQuickPick: 'Pick 1', inputBox2: 'testValue2', execute1: 'executeValue1' }
        );
    });

    test("SubWizard Execute in order", async () => {
        await validateWizard(
            {
                promptSteps: [new QuickPickStepWithSubWizard(), new QuickPickStepWithMultiStepSubWizard()],
                executeSteps: []
            },
            ['Create', 'testValue1', 'Create', 'testValue2', 'Pick 1'],
            { subInputBox: 'testValue1', inputBox2: 'testValue2', quickPick2: 'Pick 1', execute1: 'executeValue1', execute2: 'executeValue2', subExecute: 'subExecuteValue' }
        );
    });

    test("SubWizard Multi Step", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepWithMultiStepSubWizard()]
            },
            ['testValue', 'Create', 'testValue2', 'testValue3', 'Pick 1'],
            { inputBox1: 'testValue', subInputBox: 'testValue2', inputBox2: 'testValue3', quickPick2: 'Pick 1', execute1: 'executeValue1', execute2: 'executeValue2' }
        );
    });

    test("SubWizard Multi Step back", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepWithMultiStepSubWizard()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Create', TestInput.BackButton, 'Pick 1'],
            { inputBox1: 'testValue', subQuickPickMulti: 'Pick 1', execute1: 'executeValue1' }
        );
    });

    test("Sub sub wizard", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepWithSubSubWizard(), new InputBoxStep2()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Create', 'Create', 'testValue2', 'testValue3'],
            { inputBox1: 'testValue', subInputBox: 'testValue2', inputBox2: 'testValue3', execute1: 'executeValue1', subExecute: 'subExecuteValue' }
        );
    });

    test("Sub sub wizard back", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepWithSubSubWizard(), new InputBoxStep2()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Create', 'Create', 'testValue2', TestInput.BackButton, 'testValue2Changed', 'testValue3'],
            { inputBox1: 'testValue', subInputBox: 'testValue2Changed', inputBox2: 'testValue3', execute1: 'executeValue1', subExecute: 'subExecuteValue' }
        );
    });

    test("Sub sub wizard back back", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepWithSubSubWizard(), new InputBoxStep2()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Create', 'Create', TestInput.BackButton, TestInput.BackButton, 'Pick 1', 'testValue2'],
            { inputBox1: 'testValue', subSubQuickPick: 'Pick 1', inputBox2: 'testValue2', execute1: 'executeValue1' }
        );
    });

    test("Sub sub wizard execute in order", async () => {
        await validateWizard(
            {
                promptSteps: [new QuickPickStepWithSubSubExecute()],
                executeSteps: [new ExecuteStep1()]
            },
            ['Create', 'Create', 'testValue1'],
            { subInputBox: 'testValue1', execute1: 'executeValue1', subExecute: 'subExecuteValue', subSubExecute: 'subSubExecuteValue' }
        );
    });

    test("SubWizard with same step as parent wizard (before)", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new SubInputBoxStep(), new QuickPickStepWithSubWizard()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'testValue2', 'Create'],
            { inputBox1: 'testValue', subInputBox: 'testValue2', execute1: 'executeValue1', subExecute: 'subExecuteValue' }
        );
    });

    test("SubWizard with same step as parent wizard (after)", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepWithSubWizard(), new SubInputBoxStep()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Create', 'testValue2'],
            { inputBox1: 'testValue', subInputBox: 'testValue2', execute1: 'executeValue1', subExecute: 'subExecuteValue' }
        );
    });

    test("SubWizard with same step as parent wizard (before) back", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new SubInputBoxStep(), new QuickPickStepWithSubWizard(), new InputBoxStep2()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'testValue2', 'Create', TestInput.BackButton, 'Pick 1', 'testValue3'],
            { inputBox1: 'testValue', subQuickPick: 'Pick 1', subInputBox: 'testValue2', inputBox2: 'testValue3', execute1: 'executeValue1' }
        );
    });

    test("SubWizard with same step as parent wizard (after) back", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepWithSubWizard(), new SubInputBoxStep()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Create', TestInput.BackButton, 'Pick 1', 'testValue2'],
            { inputBox1: 'testValue', subQuickPick: 'Pick 1', subInputBox: 'testValue2', execute1: 'executeValue1' }
        );
    });

    test("Sub sub wizard with same step as parent wizard (before)", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new SubInputBoxStep(), new QuickPickStepWithSubSubWizard()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'testValue2', 'Create', 'Create'],
            { inputBox1: 'testValue', subInputBox: 'testValue2', execute1: 'executeValue1', subExecute: 'subExecuteValue' }
        );
    });

    test("Sub sub wizard with same step as parent wizard (after)", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepWithSubSubWizard(), new SubInputBoxStep()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Create', 'Create', 'testValue2'],
            { inputBox1: 'testValue', subInputBox: 'testValue2', execute1: 'executeValue1', subExecute: 'subExecuteValue' }
        );
    });

    test("Back button out of sub wizard", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepWithSubWizard()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Create', TestInput.BackButton, 'Pick 1'],
            { inputBox1: 'testValue', subQuickPick: 'Pick 1', execute1: 'executeValue1' }
        );
    });

    test("Back button into sub wizard", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepWithSubWizard(), new QuickPickStep1()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Create', 'subTestValue', TestInput.BackButton, 'subTestValueChanged', 'Pick 1'],
            { inputBox1: 'testValue', subInputBox: 'subTestValueChanged', quickPick1: 'Pick 1', execute1: 'executeValue1', subExecute: 'subExecuteValue' }
        );
    });

    test("Back button out of sub wizard without sub execute step", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepSubWizardNoExecute()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Pick 1', TestInput.BackButton, 'Pick 2', 'testValue2'],
            { inputBox1: 'testValue', subQuickPickNoExecute: 'Pick 2', subInputBox: 'testValue2', execute1: 'executeValue1' }
        );
    });

    test("Back button into sub wizard without sub execute step", async () => {
        await validateWizard(
            {
                promptSteps: [new InputBoxStep1(), new QuickPickStepSubWizardNoExecute(), new QuickPickStep1()],
                executeSteps: [new ExecuteStep1()]
            },
            ['testValue', 'Pick 1', 'subTestValue', TestInput.BackButton, 'subTestValueChanged', 'Pick 2'],
            { inputBox1: 'testValue', subQuickPickNoExecute: 'Pick 1', subInputBox: 'subTestValueChanged', quickPick1: 'Pick 2', execute1: 'executeValue1' }
        );
    });

    test("Back button through previous step that had been filtered", async () => {
        await validateWizard(
            {
                promptSteps: [new QuickPickStep1(), new InputBoxStepIfNotPick1(), new QuickPickStep2()],
                executeSteps: [new ExecuteStep1()]
            },
            ['Pick 1', TestInput.BackButton, 'Pick 2', 'testValue1', 'Pick 3'],
            { quickPick1: 'Pick 2', inputBoxNotPick1: 'testValue1', quickPick2: 'Pick 3', execute1: 'executeValue1' }
        );
    });

    test("Step with sub wizard but no prompt", async () => {
        await validateWizard(
            {
                promptSteps: [new QuickPickStep1(), new StepWithSubWizardAndNoPrompt()],
                executeSteps: [new ExecuteStep1()]
            },
            ['Pick 1'],
            { quickPick1: 'Pick 1', execute1: 'executeValue1', subExecute: 'subExecuteValue' }
        );
    });

    test("Back button through step with sub wizard but no prompt", async () => {
        await validateWizard(
            {
                promptSteps: [new QuickPickStep1(), new StepWithSubWizardAndNoPrompt(), new QuickPickStep2()],
                executeSteps: [new ExecuteStep1()]
            },
            ['Pick 1', TestInput.BackButton, 'Pick 2', 'Pick 3'],
            { quickPick1: 'Pick 2', quickPick2: 'Pick 3', execute1: 'executeValue1', subExecute: 'subExecuteValue' }
        );
    });
});
