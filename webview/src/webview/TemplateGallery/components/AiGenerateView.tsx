/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button, Dropdown, Field, Option, Textarea } from '@fluentui/react-components';
import { ArrowLeftRegular } from '@fluentui/react-icons';
import { useCallback, useState, type Dispatch, type JSX } from 'react';
import type { AiState, TemplateGalleryAction, WebviewToExtensionMessage } from '../types';

// Narrow the parent's action union to just the actions this component dispatches.
type ParentAction = Extract<
    TemplateGalleryAction,
    { type: 'SET_AI_PROMPT' | 'SET_AI_LANGUAGE' }
>;

interface AiGenerateViewProps {
    ai: AiState;
    postMessage: (msg: WebviewToExtensionMessage) => void;
    dispatch: Dispatch<ParentAction>;
}

type AiViewState = 'prompt' | 'chatConfirmation';

const examplePrompts: Array<{ label: string; prompt: string }> = [
    {
        label: 'HTTP API + Cosmos DB',
        prompt: 'I need an HTTP API that receives JSON payloads, validates them, and stores the records in Azure Cosmos DB. Include input validation and clear error responses.',
    },
    {
        label: 'Service Bus consumer',
        prompt: 'A Service Bus queue trigger that processes order messages, calls a downstream HTTP API to enrich each order, and writes the result to Blob Storage.',
    },
    {
        label: 'Timer-driven cleanup',
        prompt: 'A timer-triggered job that runs every night, scans a Cosmos DB container for documents older than 90 days, and archives them to Blob Storage before deleting.',
    },
    {
        label: 'Event Grid webhook',
        prompt: 'An Event Grid-triggered function that handles BlobCreated events, generates a thumbnail for each uploaded image, and writes it back to a different container.',
    },
];

export const AiGenerateView = ({ ai, postMessage, dispatch }: AiGenerateViewProps): JSX.Element => {
    const [viewState, setViewState] = useState<AiViewState>('prompt');

    const handleOpenInChat = useCallback(() => {
        if (!ai.prompt.trim()) { return; }
        postMessage({ type: 'continueInChat', prompt: ai.prompt, language: ai.language });
        setViewState('chatConfirmation');
    }, [ai.prompt, ai.language, postMessage]);

    const handleExampleClick = useCallback((prompt: string) => {
        dispatch({ type: 'SET_AI_PROMPT', prompt });
    }, [dispatch]);

    // ── Render ──

    if (viewState === 'chatConfirmation') {
        return (
            <div className="ai-content">
                <div className="ai-chat-confirmation">
                    <span className="codicon codicon-comment-discussion ai-chat-confirmation-icon"></span>
                    <div className="ai-chat-confirmation-content">
                        <h3>Copilot Chat is opening&hellip;</h3>
                        <p>
                            Your prompt has been pre-filled with Azure Functions best-practice guidance.
                            Continue the conversation in the chat panel to design and generate your app —
                            you&rsquo;ll review every change before it&rsquo;s applied to your workspace.
                        </p>
                    </div>
                    <Button
                        appearance="transparent"
                        icon={<ArrowLeftRegular />}
                        className="ai-back-link"
                        onClick={() => setViewState('prompt')}
                    >
                        Back to prompt
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="ai-content">
            <div className="ai-prompt-section">
                <div className="ai-intro">
                    <span className="codicon codicon-comment-discussion ai-intro-icon"></span>
                    <p className="ai-intro-description">
                        Describe the Azure Functions app you want to build. Copilot Chat will help you
                        design, scaffold, and refine it &mdash; with full visibility into every change
                        before it&rsquo;s applied to your workspace.
                    </p>
                </div>

                <Textarea
                    className="ai-textarea"
                    placeholder="e.g., I need an HTTP API that receives sensor readings, validates the data, and stores it in Azure Cosmos DB. It should also send alerts to a Service Bus queue when values exceed a threshold."
                    rows={5}
                    aria-label="Describe your function app"
                    value={ai.prompt}
                    onChange={(_ev, data) => dispatch({ type: 'SET_AI_PROMPT', prompt: data.value })}
                    resize="vertical"
                />

                <div className="ai-examples">
                    <span className="ai-examples-label">Try an example:</span>
                    <div className="ai-examples-chips">
                        {examplePrompts.map(ex => (
                            <Button
                                key={ex.label}
                                appearance="secondary"
                                size="small"
                                className="ai-example-chip"
                                onClick={() => handleExampleClick(ex.prompt)}
                            >
                                {ex.label}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="ai-controls">
                    <Field label="Language" className="ai-language-group">
                        <Dropdown
                            value={ai.language}
                            selectedOptions={[ai.language]}
                            onOptionSelect={(_ev, data) => {
                                if (data.optionValue) { dispatch({ type: 'SET_AI_LANGUAGE', language: data.optionValue }); }
                            }}
                            className="ai-language-select"
                        >
                            <Option value="TypeScript">TypeScript</Option>
                            <Option value="JavaScript">JavaScript</Option>
                            <Option value="Python">Python</Option>
                            <Option value="CSharp">C# (.NET)</Option>
                            <Option value="Java">Java</Option>
                            <Option value="PowerShell">PowerShell</Option>
                        </Dropdown>
                    </Field>
                    <div className="ai-action-buttons">
                        <Button
                            appearance="primary"
                            className="ai-generate-btn"
                            disabled={!ai.prompt.trim()}
                            onClick={handleOpenInChat}
                            icon={<span className="codicon codicon-comment-discussion"></span>}
                        >
                            Open in Copilot Chat
                        </Button>
                    </div>
                </div>

                <div className="ai-chat-capabilities-panel">
                    <h4>What Copilot Chat will do</h4>
                    <ul className="ai-chat-capabilities" aria-label="Copilot Chat capabilities">
                        <li><span className="codicon codicon-check"></span> Multi-turn design conversation &mdash; you stay in control</li>
                        <li><span className="codicon codicon-check"></span> Reads your workspace for context-aware suggestions</li>
                        <li><span className="codicon codicon-check"></span> Writes files directly with your review at each step</li>
                        <li><span className="codicon codicon-check"></span> Can run terminal commands and iterate on errors</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
