/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Spinner } from "@fluentui/react-components";
import { useEffect, useState } from 'react';
import { LoadingViewProgressItem } from "../extension/LoadingViewController";
import './styles/loadingView.scss';
import { LoadingViewCommands } from './webviewConstants';

type ProgressMessage = {
    command: LoadingViewCommands.AddProgressItem;
    name: string;
};

export const LoadingView = () => {
    const [progressItems, setProgressItems] = useState<LoadingViewProgressItem[]>([]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent<ProgressMessage>) => {
            const message = event.data;
            if (message.command === LoadingViewCommands.AddProgressItem) {
                setProgressItems(prev => [
                    ...prev,
                    { name: message.name }
                ]);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return (
        <div className='loadingView'>
            <div className='loadingContent'>
                <Spinner labelPosition="below" label="Generating Copilot responses..." />
                <div className='progressList'>
                    {progressItems.length > 0 ? (
                        progressItems.map((item, index) => (
                            <div key={`${item.name}-${index}`} className='progressItem'>
                                <span className='checkmark codicon codicon-check'></span>
                                <span className='itemName'>{item.name}</span>
                            </div>
                        ))
                    ) : (
                        Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className='progressItemPlaceholder'>
                                <span className='placeholderIcon' />
                                <span className='placeholderText' style={{ width: `${60 + index * 15}%` }} />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
