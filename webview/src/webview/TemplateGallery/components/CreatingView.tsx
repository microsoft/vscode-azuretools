/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Spinner } from '@fluentui/react-components';
import type { JSX } from 'react';

interface CreatingViewProps {
    detail: string;
}

export const CreatingView = ({ detail }: CreatingViewProps): JSX.Element => (
    <div className="creating-view">
        <div className="creating-content">
            <Spinner size="large" label="Creating project..." />
            <p>{detail || 'Cloning template repository'}</p>
        </div>
    </div>
);
