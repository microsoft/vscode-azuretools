/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JSX } from 'react';

interface CreatingViewProps {
    detail: string;
}

export const CreatingView = ({ detail }: CreatingViewProps): JSX.Element => (
    <div className="creating-view">
        <div className="creating-content">
            <span className="codicon codicon-loading codicon-modifier-spin creating-spinner"></span>
            <h2>Creating project...</h2>
            <p>{detail || 'Cloning template repository'}</p>
        </div>
    </div>
);
