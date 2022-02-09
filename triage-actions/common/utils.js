"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
exports.getInput = (name) => core.getInput(name) || undefined;
exports.getRequiredInput = (name) => core.getInput(name, { required: true });
exports.daysSince = (timestamp) => (Date.now() - timestamp) / 1000 / 60 / 60 / 24;
exports.daysAgoToTimestamp = (days) => +new Date(Date.now() - days * 24 * 60 * 60 * 1000);
exports.daysAgoToHumanReadbleDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}\w$/, '');
exports.safeLog = (message, ...args) => {
    const clean = (val) => ('' + val).replace(/:|#/g, '');
    console.log(clean(message), ...args.map(clean));
};
//# sourceMappingURL=utils.js.map