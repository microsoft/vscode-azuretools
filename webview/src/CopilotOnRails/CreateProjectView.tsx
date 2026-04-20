/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button, Textarea } from '@fluentui/react-components';
import { ClipboardTaskListLtrRegular, RocketRegular } from '@fluentui/react-icons';
import * as React from 'react';
import { useContext, useState, type JSX } from 'react';
import { CreateProjectViewCommands } from '../webviewConstants';
import { WebviewContext } from '../WebviewContext';
import './styles/createProjectView.scss';


export const CreateProjectView = (): JSX.Element => {
    const [prompt, setPrompt] = useState('');
    const { vscodeApi } = useContext(WebviewContext);

    const planClicked = () => {
        if (!prompt.trim()) {
            return;
        }
        vscodeApi.postMessage({
            command: CreateProjectViewCommands.Plan,
            prompt: prompt.trim(),
        });
    };

    const buildClicked = () => {
        if (!prompt.trim()) {
            return;
        }
        vscodeApi.postMessage({
            command: CreateProjectViewCommands.Build,
            prompt: prompt.trim(),
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            buildClicked();
        }
    };

    return (
        <div className='createProjectView'>
            <div className='content'>
                <div className='headerSection'>
                    <div className='headerIcon'>
                        <div className='codicon codicon-copilot'></div>
                    </div>
                    <h1>What would you like to build?</h1>
                    <p className='subtitle'>
                        Describe your project and Copilot will help you build and deploy it to Azure Container Apps.
                    </p>
                </div>

                <div className='promptCard'>
                    <Textarea
                        className='promptInput'
                        placeholder='Describe your project...'
                        value={prompt}
                        onChange={(_e, data) => setPrompt(data.value)}
                        onKeyDown={handleKeyDown}
                        rows={6}
                        resize='vertical'
                    />
                    <div className='promptActions'>
                        <span className='hint'>Ctrl+Enter to build</span>
                        <div className='buttonGroup'>
                            <Button
                                appearance='secondary'
                                onClick={planClicked}
                                disabled={!prompt.trim()}
                                icon={<ClipboardTaskListLtrRegular />}
                            >
                                Plan
                            </Button>
                            <Button
                                appearance='primary'
                                onClick={buildClicked}
                                disabled={!prompt.trim()}
                                icon={<RocketRegular />}
                            >
                                Build
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
