/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Checkbox } from '@fluentui/react-components';
import { useId, type JSX } from 'react';
import type { TemplateGalleryWorkspaceOption, TemplateGalleryWorkspaceOptionValues } from '../types';

interface WorkspaceOptionsProps {
    options: readonly TemplateGalleryWorkspaceOption[];
    values: TemplateGalleryWorkspaceOptionValues;
    onChange: (id: string, checked: boolean) => void;
}

export const WorkspaceOptions = ({ options, values, onChange }: WorkspaceOptionsProps): JSX.Element | null => {
    const descriptionIdPrefix = useId();

    if (options.length === 0) {
        return null;
    }

    return (
        <div className="workspace-options" role="group" aria-label="Workspace options">
            {options.map((option, index) => {
                const descriptionId = option.description ? `${descriptionIdPrefix}-${index}` : undefined;

                return (
                    <div key={option.id} className="workspace-option">
                        <Checkbox
                            aria-describedby={descriptionId}
                            checked={values[option.id] ?? option.defaultValue}
                            label={option.label}
                            onChange={(_ev, data) => onChange(option.id, data.checked === true)}
                        />
                        {option.description && (
                            <div id={descriptionId} className="workspace-option-description">{option.description}</div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
