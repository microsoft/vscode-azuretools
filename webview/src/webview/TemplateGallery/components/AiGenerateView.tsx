/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { useState, useEffect, useRef, useCallback, type JSX, type Dispatch } from 'react';
import type { AiState, WebviewToExtensionMessage, AiCompleteMessage } from '../types';

const examplePrompts = [
    { label: 'HTTP API → Cosmos DB', prompt: 'HTTP API that accepts JSON sensor data, validates it, and stores it in Azure Cosmos DB' },
    { label: 'Nightly archive job', prompt: 'Timer function that runs every night at midnight to archive old blob files and log results to Application Insights' },
    { label: 'Service Bus → Email', prompt: 'Process messages from an Azure Service Bus queue and send email notifications using Azure Communication Services' },
    { label: 'AI image analysis pipeline', prompt: 'Blob trigger that activates when an image is uploaded, analyzes it with Azure AI Vision, and saves results to a Cosmos DB container' },
];

const progressMessages = [
    'Analyzing your requirements...',
    'Designing project structure...',
    'Writing function code...',
    'Adding configuration files...',
];

// Dispatch action types from the parent reducer
type ParentAction =
    | { type: 'SET_AI_PROMPT'; prompt: string }
    | { type: 'SET_AI_LANGUAGE'; language: string }
    | { type: 'SET_AI_GENERATING' }
    | { type: 'SET_AI_LOCATION'; path: string }
    | { type: 'SET_VIEW'; view: 'creating' }
    | { type: 'AI_COMPLETE'; data: AiCompleteMessage['projectData']; title: string; description: string; files: string[] }
    | { type: 'AI_ERROR'; error: string };

interface AiGenerateViewProps {
    ai: AiState;
    postMessage: (msg: WebviewToExtensionMessage) => void;
    dispatch: Dispatch<ParentAction>;
}

type AiViewState = 'prompt' | 'generating' | 'success' | 'error' | 'chatConfirmation';

export const AiGenerateView = ({ ai, postMessage, dispatch }: AiGenerateViewProps): JSX.Element => {
    const [viewState, setViewState] = useState<AiViewState>('prompt');
    const [progressStep, setProgressStep] = useState(0);
    const [showExtendedWait, setShowExtendedWait] = useState(false);
    const [aiTitle, setAiTitle] = useState('');
    const [aiDescription, setAiDescription] = useState('');
    const [aiFiles, setAiFiles] = useState<string[]>([]);
    const [errorMessage, _setErrorMessage] = useState('');
    const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const extendedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync with parent state for generating/complete/error
    useEffect(() => {
        if (ai.isGenerating && viewState !== 'generating') {
            startProgressAnimation();
            setViewState('generating');
        }
    }, [ai.isGenerating]);

    // Listen for AI complete/error from parent
    useEffect(() => {
        if (!ai.isGenerating && ai.projectData && viewState === 'generating') {
            completeProgress();
            setAiTitle(ai.projectData.title || '');
            setAiDescription(ai.projectData.description || '');
            setAiFiles(ai.projectData.files?.map(f => f.path) || []);
            setTimeout(() => setViewState('success'), 400);
        }
    }, [ai.isGenerating, ai.projectData]);

    const startProgressAnimation = useCallback(() => {
        setProgressStep(0);
        setShowExtendedWait(false);
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        if (extendedTimerRef.current) clearTimeout(extendedTimerRef.current);

        let step = 0;
        progressTimerRef.current = setInterval(() => {
            step++;
            if (step < progressMessages.length) {
                setProgressStep(step);
                if (step === progressMessages.length - 1) {
                    // Last step — stop timer, show extended wait after 3s
                    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
                    progressTimerRef.current = null;
                    extendedTimerRef.current = setTimeout(() => setShowExtendedWait(true), 3000);
                }
            } else {
                if (progressTimerRef.current) clearInterval(progressTimerRef.current);
                progressTimerRef.current = null;
            }
        }, 2500);
    }, []);

    const completeProgress = useCallback(() => {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        if (extendedTimerRef.current) clearTimeout(extendedTimerRef.current);
        progressTimerRef.current = null;
        extendedTimerRef.current = null;
        setProgressStep(progressMessages.length);
        setShowExtendedWait(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            if (extendedTimerRef.current) clearTimeout(extendedTimerRef.current);
        };
    }, []);

    // Handle AI error
    useEffect(() => {
        if (!ai.isGenerating && !ai.projectData && viewState === 'generating') {
            // Error case: not generating, no data, but we were generating
            completeProgress();
            setViewState('error');
        }
    }, [ai.isGenerating, ai.projectData, viewState]);

    const handleGenerate = useCallback(() => {
        if (!ai.prompt.trim()) return;
        dispatch({ type: 'SET_AI_GENERATING' });
        setViewState('generating');
        startProgressAnimation();
        postMessage({ type: 'generateWithCopilot', prompt: ai.prompt, language: ai.language });
    }, [ai.prompt, ai.language, dispatch, postMessage, startProgressAnimation]);

    const handleRegenerate = useCallback(() => {
        dispatch({ type: 'SET_AI_LOCATION', path: '' });
        if (ai.prompt) {
            dispatch({ type: 'SET_AI_GENERATING' });
            setViewState('generating');
            startProgressAnimation();
            postMessage({ type: 'generateWithCopilot', prompt: ai.prompt, language: ai.language });
        }
    }, [ai.prompt, ai.language, dispatch, postMessage, startProgressAnimation]);

    const handleCreate = useCallback(() => {
        if (!ai.location || !ai.projectData) return;
        dispatch({ type: 'SET_VIEW', view: 'creating' });
        postMessage({
            type: 'createAiProject',
            files: ai.projectData.files,
            location: ai.location,
        });
    }, [ai.location, ai.projectData, dispatch, postMessage]);

    const handleContinueInChat = useCallback((context: 'prompt' | 'success' | 'error') => {
        postMessage({
            type: 'continueInChat',
            prompt: ai.prompt,
            language: ai.language,
            context,
            projectData: context === 'success' && ai.projectData
                ? { title: ai.projectData.title, description: ai.projectData.description }
                : undefined,
        });
        setViewState('chatConfirmation');
    }, [ai, postMessage]);

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
                        <p>Your prompt has been pre-filled. Continue the conversation to design and generate your function app.</p>
                    </div>
                    <button className="ai-chat-link ai-back-link" onClick={() => setViewState(ai.projectData ? 'success' : 'prompt')}>
                        <span className="codicon codicon-arrow-left"></span>
                        Back to generator
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="ai-content">
            {/* Prompt Section */}
            {viewState === 'prompt' && (
                <div className="ai-prompt-section">
                    <div className="ai-intro">
                        <span className="codicon codicon-sparkle ai-intro-icon"></span>
                        <div>
                            <h2 className="ai-intro-title">Generate with GitHub Copilot</h2>
                            <p className="ai-intro-description">
                                Describe the Azure Function app you want to build. Copilot will generate a complete, working project tailored to your needs.
                            </p>
                        </div>
                    </div>

                    <textarea
                        className="ai-textarea"
                        placeholder="e.g., I need an HTTP API that receives sensor readings, validates the data, and stores it in Azure Cosmos DB. It should also send alerts to a Service Bus queue when values exceed a threshold."
                        rows={5}
                        aria-label="Describe your function app"
                        value={ai.prompt}
                        onChange={e => dispatch({ type: 'SET_AI_PROMPT', prompt: e.target.value })}
                    />

                    <div className="example-prompts">
                        <span className="example-label">Try an example:</span>
                        <div className="example-chips">
                            {examplePrompts.map(ex => (
                                <button key={ex.label} className="example-chip" onClick={() => handleExampleClick(ex.prompt)}>
                                    {ex.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="ai-controls">
                        <div className="ai-language-group">
                            <label htmlFor="ai-language-select">Language</label>
                            <select
                                id="ai-language-select"
                                className="form-select ai-language-select"
                                value={ai.language}
                                onChange={e => dispatch({ type: 'SET_AI_LANGUAGE', language: e.target.value })}
                            >
                                <option value="TypeScript">TypeScript</option>
                                <option value="JavaScript">JavaScript</option>
                                <option value="Python">Python</option>
                                <option value="CSharp">C# (.NET)</option>
                                <option value="Java">Java</option>
                                <option value="PowerShell">PowerShell</option>
                            </select>
                        </div>
                        <button
                            className="ai-generate-btn"
                            disabled={!ai.prompt.trim() || ai.isGenerating}
                            onClick={handleGenerate}
                        >
                            <span className="codicon codicon-sparkle"></span>
                            Generate Project
                        </button>
                    </div>

                    <div className="ai-chat-action">
                        <button className="ai-chat-link" onClick={() => handleContinueInChat('prompt')}>
                            <span className="codicon codicon-comment-discussion"></span>
                            Continue in Copilot Chat
                        </button>
                        <span className="ai-chat-hint">For complex apps that need multi-turn design</span>
                    </div>

                    <details className="ai-chat-details">
                        <summary>What can Copilot Chat do?</summary>
                        <ul className="ai-chat-capabilities">
                            <li><span className="codicon codicon-check"></span> Multi-turn conversation to refine your app design</li>
                            <li><span className="codicon codicon-check"></span> Access to workspace files for context-aware generation</li>
                            <li><span className="codicon codicon-check"></span> Built-in tools: file editing, terminal, search</li>
                            <li><span className="codicon codicon-check"></span> Iterative code review and debugging assistance</li>
                        </ul>
                    </details>
                </div>
            )}

            {/* Generating State */}
            {viewState === 'generating' && (
                <div className="ai-output">
                    <div className="ai-generating-state">
                        <div className="ai-steps">
                            {progressMessages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={`ai-step ${i < progressStep ? 'done' : ''} ${i === progressStep && progressStep < progressMessages.length ? 'active' : ''}`}
                                >
                                    <span className={`codicon ${
                                        i < progressStep ? 'codicon-check' :
                                        i === progressStep && progressStep < progressMessages.length ? 'codicon-loading codicon-modifier-spin' :
                                        'codicon-circle-outline'
                                    }`}></span>
                                    <span>{msg}</span>
                                </div>
                            ))}
                        </div>
                        <p className="ai-status-text">{progressMessages[Math.min(progressStep, progressMessages.length - 1)]}</p>
                        {showExtendedWait && (
                            <div className="ai-extended-wait">
                                <div className="ai-dots-container">
                                    <span className="ai-dot"></span>
                                    <span className="ai-dot"></span>
                                    <span className="ai-dot"></span>
                                </div>
                                <div className="ai-extended-wait-text">
                                    <span>Copilot is writing your project files&hellip;</span>
                                    <span className="ai-extended-wait-sub">This can take 30–60 seconds for larger projects</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Success State */}
            {viewState === 'success' && (
                <div className="ai-output">
                    <div className="ai-success-state">
                        <div className="ai-success-header">
                            <span className="codicon codicon-check-all ai-success-icon"></span>
                            <div>
                                <h3 className="ai-project-title">{aiTitle}</h3>
                                <p className="ai-project-description">{aiDescription}</p>
                            </div>
                        </div>
                        <div className="ai-files-section">
                            <h4>Files that will be created:</h4>
                            <ul className="ai-files-list">
                                {aiFiles.map((f, i) => (
                                    <li key={i}>
                                        <span className="codicon codicon-file"></span>{f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="form-group">
                            <label htmlFor="ai-location-input">Project Location</label>
                            <div className="location-input-group">
                                <input
                                    type="text"
                                    id="ai-location-input"
                                    className="form-input"
                                    readOnly
                                    placeholder="Select a folder..."
                                    value={ai.location}
                                />
                                <button type="button" className="secondary-button" onClick={() => postMessage({ type: 'browseFolder', source: 'ai' })}>
                                    Browse...
                                </button>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button
                                type="button"
                                className="primary-button"
                                disabled={!ai.location || !ai.projectData}
                                onClick={handleCreate}
                            >
                                <span className="codicon codicon-check"></span>
                                Create Project
                            </button>
                        </div>
                        <div className="ai-escalation">
                            <span>Want to refine this further?</span>
                            <button className="ai-chat-link" onClick={() => handleContinueInChat('success')}>
                                <span className="codicon codicon-comment-discussion"></span>
                                Continue in Copilot Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error State */}
            {viewState === 'error' && (
                <div className="ai-output">
                    <div className="ai-error-state">
                        <span className="codicon codicon-warning ai-error-icon"></span>
                        <p className="ai-error-message">{errorMessage || 'An error occurred'}</p>
                        <button className="secondary-button" onClick={handleRegenerate}>Try Again</button>
                        <div className="ai-escalation">
                            <span>Or try in Copilot Chat instead:</span>
                            <button className="ai-chat-link" onClick={() => handleContinueInChat('error')}>
                                <span className="codicon codicon-comment-discussion"></span>
                                Continue in Copilot Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
