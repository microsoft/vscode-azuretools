/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Spinner } from "@fluentui/react-components";
import './styles/loadingView.scss';

export const LoadingView = () =>
    <div className='loadingView'>
        <Spinner labelPosition="below" label="Generating Copilot responses..." />
    </div>;
