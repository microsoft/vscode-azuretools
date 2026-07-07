/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button, Dropdown, Field, Option, Textarea } from '@fluentui/react-components';
import { ArrowLeftRegular } from '@fluentui/react-icons';
import { useCallback, useState, type Dispatch, type JSX } from 'react';
import { useTemplateGalleryConfig } from '../TemplateGalleryConfigContext';
import type { AiState, TemplateGalleryAction, WebviewToExtensionMessage } from '../types';

// Narrow the parent's action union to just the actions this component dispatches.
type ParentAction = Extract<
    TemplateGalleryAction,
    { type: 'SET_AI_PROMPT' | 'SET_AI_LANGUAGE' }
>;

interface AiGenerateViewProps {
    ai: AiState;
    projectLocation: string;
    postMessage: (msg: WebviewToExtensionMessage) => void;
    dispatch: Dispatch<ParentAction>;
}

type AiViewState = 'prompt' | 'chatConfirmation';

export const AiGenerateView = ({ ai, projectLocation, postMessage, dispatch }: AiGenerateViewProps): JSX.Element => {
    const [viewState, setViewState] = useState<AiViewState>('prompt');
    const { aiGeneration } = useTemplateGalleryConfig();

    const handleOpenInChat = useCallback(() => {
        if (!ai.prompt.trim()) { return; }
        postMessage({ type: 'continueInChat', prompt: ai.prompt, language: ai.language, location: projectLocation });
        setViewState('chatConfirmation');
    }, [ai.prompt, ai.language, projectLocation, postMessage]);

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
                        <h3>{aiGeneration.chatConfirmationTitle}</h3>
                        <p>{aiGeneration.chatConfirmationDescription}</p>
                    </div>
                    <Button
                        appearance="transparent"
                        icon={<ArrowLeftRegular />}
                        className="ai-back-link"
                        onClick={() => setViewState('prompt')}
                    >
                        {aiGeneration.chatConfirmationBackLabel}
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
                    <p className="ai-intro-description">{aiGeneration.introDescription}</p>
                </div>

                <Textarea
                    className="ai-textarea"
                    placeholder={aiGeneration.promptPlaceholder}
                    rows={5}
                    aria-label={aiGeneration.promptAriaLabel}
                    value={ai.prompt}
                    onChange={(_ev, data) => dispatch({ type: 'SET_AI_PROMPT', prompt: data.value })}
                    resize="vertical"
                />

                {aiGeneration.examplePrompts.length > 0 && (
                    <div className="ai-examples">
                        <span className="ai-examples-label">{aiGeneration.examplesLabel}</span>
                        <div className="ai-examples-chips">
                            {aiGeneration.examplePrompts.map(ex => (
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
                )}

                <div className="ai-controls">
                    <Field label={aiGeneration.languageLabel} className="ai-language-group">
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
                            {aiGeneration.openChatButtonLabel}
                        </Button>
                    </div>
                </div>

                {aiGeneration.capabilities.length > 0 && (
                    <div className="ai-chat-capabilities-panel">
                        <h4>{aiGeneration.capabilitiesTitle}</h4>
                        <ul className="ai-chat-capabilities" aria-label={aiGeneration.capabilitiesAriaLabel}>
                            {aiGeneration.capabilities.map(capability => (
                                <li key={capability}>
                                    <span className="codicon codicon-check"></span> {capability}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};
