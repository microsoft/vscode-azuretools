/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as opn from 'opn';
import { window } from 'vscode';
import { localize } from "./localize";

export class UserCancelledError extends Error { }

export class WizardFailedError extends Error {
    public readonly stepTitle: string;
    public readonly stepIndex: number;
    constructor(error: Error, stepTitle: string, stepIndex: number) {
        super();
        this.message = error.message;
        this.stepTitle = stepTitle;
        this.stepIndex = stepIndex;
    }
}

export class ArgumentError extends Error {
    constructor(obj: object) {
        super(localize('azFunc.argumentError', 'Invalid {0}.', obj.constructor.name));
    }
}

// tslint:disable-next-line:max-classes-per-file
export class GitNotInstalledError extends Error {
    constructor() {
        super();
        // tslint:disable-next-line:no-floating-promises
        this.showInstallPrompt();
    }

    public async showInstallPrompt(): Promise<void> {
        const installString: string = 'Install';
        const input: string | undefined = await window.showErrorMessage('Git must be installed to use Local Git Deploy.', installString);
        if (input === installString) {
            // tslint:disable-next-line:no-unsafe-any
            opn('https://git-scm.com/downloads');
        }
    }
}

// tslint:disable-next-line:max-classes-per-file
export class LocalGitDeployError extends Error {
    public readonly servicePlanSize: string;
    constructor(error: Error, servicePlanSize: string) {
        super();
        this.message = error.message;
        this.servicePlanSize = servicePlanSize;
    }
}
