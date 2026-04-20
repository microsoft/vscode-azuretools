/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfirmationView } from "./ConfirmationView";
import { CreateProjectView } from "./CopilotOnRails/CreateProjectView";
import { DeploymentPlanView } from "./CopilotOnRails/DeploymentPlanView";
import { LocalPlanView } from "./CopilotOnRails/LocalPlanView";
import { ScaffoldPlanView } from "./CopilotOnRails/ScaffoldPlanView";
import { LoadingView } from "./LoadingView";

export const WebviewRegistry = {
    confirmationView: ConfirmationView,
    createProjectView: CreateProjectView,
    deploymentPlanView: DeploymentPlanView,
    loadingView: LoadingView,
    localPlanView: LocalPlanView,
    scaffoldPlanView: ScaffoldPlanView,
} as const;
