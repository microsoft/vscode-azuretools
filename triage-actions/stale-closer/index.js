"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
const StaleCloser_1 = require("./StaleCloser");
class Stale extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'Stale';
    }
    async onTriggered(github) {
        await new StaleCloser_1.StaleCloser(github, +utils_1.getRequiredInput('closeDays'), utils_1.getRequiredInput('closeComment'), +utils_1.getRequiredInput('warnDays'), utils_1.getRequiredInput('warnComment'), +utils_1.getRequiredInput('upvotesRequired'), +utils_1.getRequiredInput('numCommentsOverride'), utils_1.getRequiredInput('candidateMilestone'), utils_1.getInput('labelsToExclude'), utils_1.getInput('staleLabel')).run();
    }
}
new Stale().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map