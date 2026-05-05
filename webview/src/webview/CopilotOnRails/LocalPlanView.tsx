/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button, CounterBadge, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Spinner, Textarea } from '@fluentui/react-components';
import { CheckmarkRegular, CommentEditRegular, DismissRegular, SendRegular } from '@fluentui/react-icons';
import mermaid from 'mermaid';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { WebviewContext } from '../WebviewContext';
import '../styles/localPlanView.scss';
import { type LocalPlanContent, type LocalPlanData, type LocalPlanSection } from './utils/parseLocalPlanMarkdown';

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontSize: 30,
    flowchart: {
        nodeSpacing: 60,
        rankSpacing: 80,
        padding: 20,
        useMaxWidth: false,
    },
});
let mermaidIdCounter = 0;

const alwaysExpandedSections = new Set(['project analysis', 'prerequisites', 'scan results']);

interface FeedbackItem {
    id: string;
    text: string;
}

let feedbackIdCounter = 0;
const nextId = (): string => `fb-${++feedbackIdCounter}`;

function buildFeedbackPrompt(items: FeedbackItem[]): string {
    const notes = items
        .map(i => `- ${i.text.trim()}`)
        .filter(t => t.length > 2);

    const lines: string[] = [
        'Please revise the local development plan based on my feedback and update local-development-plan.md.',
        'Keep existing sections unchanged unless a change below implies otherwise. Wait for my approval after updating the file.',
        '',
    ];
    if (notes.length > 0) {
        lines.push('Notes:', ...notes, '');
    }
    return lines.join('\n').trimEnd();
}

export const LocalPlanView = (): JSX.Element => {
    const [plan, setPlan] = useState<LocalPlanData | null>(null);
    const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
    const [freeformDraft, setFreeformDraft] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [isAwaitingRevision, setIsAwaitingRevision] = useState(false);
    const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
    const { vscodeApi } = useContext(WebviewContext);

    const hasEdits = useMemo(
        () => feedbackItems.length > 0 || freeformDraft.trim().length > 0,
        [feedbackItems, freeformDraft],
    );

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (message?.command === 'setLocalPlanData') {
                setPlan(message.data as LocalPlanData);
                // New plan data from the controller — either the initial load or a
                // post-revision refresh. Either way, clear pending feedback state.
                setFeedbackItems([]);
                setFreeformDraft('');
            } else if (message?.command === 'revisionInProgress') {
                setIsAwaitingRevision(true);
                setDrawerOpen(false);
            } else if (message?.command === 'revisionComplete') {
                setIsAwaitingRevision(false);
            }
        };
        window.addEventListener('message', handler);
        vscodeApi.postMessage({ command: 'ready' });
        return () => window.removeEventListener('message', handler);
    }, []);

    const handleApprove = useCallback(() => {
        if (!plan) {
            return;
        }
        if (hasEdits) {
            setConfirmSubmitOpen(true);
            return;
        }
        vscodeApi.postMessage({ command: 'approvePlan', data: plan });
    }, [plan, hasEdits, vscodeApi]);

    const handleRemoveFeedback = useCallback((id: string) => {
        setFeedbackItems(prev => prev.filter(i => i.id !== id));
    }, []);

    const handleAddNote = useCallback(() => {
        const text = freeformDraft.trim();
        if (!text) {
            return;
        }
        setFeedbackItems(prev => [...prev, { id: nextId(), text }]);
        setFreeformDraft('');
    }, [freeformDraft]);

    const handleDiscardAll = useCallback(() => {
        setFeedbackItems([]);
        setFreeformDraft('');
    }, []);

    const handleSubmitFeedback = useCallback(() => {
        if (!plan || !hasEdits) {
            return;
        }
        const draftTrimmed = freeformDraft.trim();
        const items = draftTrimmed.length > 0
            ? [...feedbackItems, { id: nextId(), text: draftTrimmed }]
            : feedbackItems;
        const prompt = buildFeedbackPrompt(items);
        vscodeApi.postMessage({ command: 'submitPlanFeedback', prompt, data: plan });
        setIsAwaitingRevision(true);
        setDrawerOpen(false);
        setConfirmSubmitOpen(false);
    }, [plan, hasEdits, feedbackItems, freeformDraft, vscodeApi]);

    if (!plan) {
        return <div className='localPlanView'><p>Loading local dev plan...</p></div>;
    }

    return (
        <div className={`localPlanView ${drawerOpen ? 'drawerOpen' : ''} ${isAwaitingRevision ? 'revising' : ''}`}>
            <div className='planMain'>
                <div className='planHeader'>
                    <div className='headerTop'>
                        <div>
                            <h1>{plan.title}</h1>
                            <div className='metadataBadges'>
                                <span className='badge'>{plan.status}</span>
                            </div>
                            {plan.headerNote && (
                                <p className='headerNote' dangerouslySetInnerHTML={{ __html: formatInline(plan.headerNote) }} />
                            )}
                        </div>
                        <div className='headerActions'>
                            <Button
                                appearance='subtle'
                                aria-label='Feedback'
                                icon={
                                    <span className='feedbackIconWrapper'>
                                        <CommentEditRegular />
                                        {hasEdits && (
                                            <CounterBadge
                                                className='feedbackBadge'
                                                count={feedbackItems.length + (freeformDraft.trim() ? 1 : 0)}
                                                size='small'
                                                color='danger'
                                            />
                                        )}
                                    </span>
                                }
                                disabled={isAwaitingRevision}
                                onClick={() => setDrawerOpen(v => !v)}
                            />
                            <Button
                                appearance='primary'
                                icon={<CheckmarkRegular />}
                                disabled={isAwaitingRevision}
                                onClick={handleApprove}
                            >
                                Approve Plan
                            </Button>
                        </div>
                    </div>
                </div>

                {isAwaitingRevision && (
                    <div className='revisionBanner' role='status' aria-live='polite'>
                        <Spinner size='tiny' />
                        <span>Copilot is revising the plan…</span>
                    </div>
                )}

                {plan.sections
                    .filter((s) => !isHiddenSection(s.title))
                    .map((section, i) => (
                        <SectionCard
                            key={i}
                            section={section}
                            collapsible={!alwaysExpandedSections.has(section.title.toLowerCase())}
                        />
                    ))}
            </div>

            {drawerOpen && !isAwaitingRevision && (
                <FeedbackDrawer
                    items={feedbackItems}
                    freeformDraft={freeformDraft}
                    onFreeformChange={setFreeformDraft}
                    onAddNote={handleAddNote}
                    onRemoveItem={handleRemoveFeedback}
                    onSubmit={handleSubmitFeedback}
                    onDiscardAll={handleDiscardAll}
                    onClose={() => setDrawerOpen(false)}
                />
            )}

            <SubmitEditsDialog
                open={confirmSubmitOpen}
                editCount={feedbackItems.length + (freeformDraft.trim() ? 1 : 0)}
                onCancel={() => setConfirmSubmitOpen(false)}
                onSubmit={handleSubmitFeedback}
            />
        </div>
    );
};

interface FeedbackDrawerProps {
    items: FeedbackItem[];
    freeformDraft: string;
    onFreeformChange: (value: string) => void;
    onAddNote: () => void;
    onRemoveItem: (id: string) => void;
    onSubmit: () => void;
    onDiscardAll: () => void;
    onClose: () => void;
}

const FeedbackDrawer = ({ items, freeformDraft, onFreeformChange, onAddNote, onRemoveItem, onSubmit, onDiscardAll, onClose }: FeedbackDrawerProps): JSX.Element => {
    const hasAny = items.length > 0 || freeformDraft.trim().length > 0;
    return (
        <aside className='feedbackDrawer' aria-label='Plan feedback'>
            <div className='drawerHeader'>
                <h2>Request changes</h2>
                <Button
                    appearance='subtle'
                    icon={<DismissRegular />}
                    aria-label='Close feedback'
                    onClick={onClose}
                />
            </div>

            <div className='drawerBody'>
                {items.length === 0 && (
                    <p className='drawerHint'>
                        Add a free-form note for Copilot describing the changes you'd like to see in this plan.
                    </p>
                )}

                {items.length > 0 && (
                    <ul className='feedbackList'>
                        {items.map(item => (
                            <li key={item.id} className='feedbackItem freeform'>
                                <span className='feedbackFreeformText'>{item.text}</span>
                                <Button
                                    appearance='subtle'
                                    size='small'
                                    icon={<DismissRegular />}
                                    aria-label='Remove feedback item'
                                    onClick={() => onRemoveItem(item.id)}
                                />
                            </li>
                        ))}
                    </ul>
                )}

                <div className='freeformBlock'>
                    <Textarea
                        value={freeformDraft}
                        onChange={(_, data) => onFreeformChange(data.value)}
                        placeholder='Add a note for Copilot (e.g. "Use Azurite instead of the storage emulator")'
                        rows={3}
                        resize='vertical'
                    />
                    <div className='freeformActions'>
                        <Button
                            appearance='secondary'
                            size='small'
                            disabled={freeformDraft.trim().length === 0}
                            onClick={onAddNote}
                        >
                            Add note
                        </Button>
                    </div>
                </div>
            </div>

            <div className='drawerFooter'>
                <Button
                    appearance='subtle'
                    disabled={!hasAny}
                    onClick={onDiscardAll}
                >
                    Discard all
                </Button>
                <Button
                    appearance='primary'
                    icon={<SendRegular />}
                    disabled={!hasAny}
                    onClick={onSubmit}
                >
                    Submit feedback
                </Button>
            </div>
        </aside>
    );
};

interface SubmitEditsDialogProps {
    open: boolean;
    editCount: number;
    onCancel: () => void;
    onSubmit: () => void;
}

const SubmitEditsDialog = ({ open, editCount, onCancel, onSubmit }: SubmitEditsDialogProps): JSX.Element => (
    <Dialog open={open} onOpenChange={(_, data) => { if (!data.open) { onCancel(); } }}>
        <DialogSurface>
            <DialogBody>
                <DialogTitle>Submit edits to Copilot?</DialogTitle>
                <DialogContent>
                    {editCount > 0
                        ? `You have ${editCount} pending edit${editCount === 1 ? '' : 's'}. Would you like to submit ${editCount === 1 ? 'it' : 'them'} to Copilot to revise the plan?`
                        : 'Edits were made. Would you like to submit those edits to Copilot?'}
                </DialogContent>
                <DialogActions>
                    <Button appearance='secondary' onClick={onCancel}>Cancel</Button>
                    <Button appearance='primary' icon={<SendRegular />} onClick={onSubmit}>Submit edits</Button>
                </DialogActions>
            </DialogBody>
        </DialogSurface>
    </Dialog>
);

const SectionCard = ({ section, collapsible }: { section: LocalPlanSection; collapsible: boolean }): JSX.Element => {
    const [open, setOpen] = useState(!collapsible);

    return (
        <div className='sectionCard'>
            <div
                className={`sectionHeading ${collapsible ? 'clickable' : ''}`}
                onClick={() => collapsible && setOpen(!open)}
            >
                {collapsible && <span className={`sectionChevron ${open ? 'open' : ''}`}>▶</span>}
                <h2>{section.title}</h2>
            </div>
            {open && (
                <div className='sectionContent'>
                    {section.content.map((item, i) => (
                        <ContentBlock key={i} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
};

function isHiddenSection(title: string): boolean {
    const lower = title.toLowerCase();
    return lower === 'execution checklist' || lower === 'manual tests';
}

const ContentBlock = ({ item }: { item: LocalPlanContent }): JSX.Element => {
    switch (item.type) {
        case 'table':
            return <TableBlock headers={item.headers} rows={item.rows} />;
        case 'codeBlock':
            if (item.language?.toLowerCase() === 'mermaid') {
                return <MermaidBlock code={item.code} />;
            }
            return <CodeBlock language={item.language} code={item.code} />;
        case 'bulletList':
            return <BulletListBlock items={item.items} />;
        case 'blockquote':
            return <BlockquoteBlock text={item.text} />;
        case 'paragraph':
            return <p className='paragraph' dangerouslySetInnerHTML={{ __html: formatInline(item.text) }} />;
        case 'subsection':
            return <SubsectionBlock title={item.title} content={item.content} />;
    }
};

const TableBlock = ({ headers, rows }: { headers: string[]; rows: string[][] }): JSX.Element => (
    <table className='planTable'>
        <thead>
            <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
            {rows.map((row, ri) => (
                <tr key={ri}>
                    {row.map((cell, ci) => (
                        <td key={ci} dangerouslySetInnerHTML={{ __html: formatInline(cell) }} />
                    ))}
                </tr>
            ))}
        </tbody>
    </table>
);

const CodeBlock = ({ language, code }: { language: string; code: string }): JSX.Element => (
    <div className='codeBlock'>
        {language && <span className='codeBlockLang'>{language}</span>}
        <pre><code>{code}</code></pre>
    </div>
);

const MermaidBlock = ({ code }: { code: string }): JSX.Element => {
    const ref = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const id = `mermaid-diagram-${++mermaidIdCounter}`;
        mermaid.render(id, code).then(({ svg }) => {
            if (!cancelled && ref.current) {
                ref.current.innerHTML = svg;
                setError(null);
            }
        }).catch((err: Error) => {
            if (!cancelled) {
                setError(err.message);
            }
        });
        return () => { cancelled = true; };
    }, [code]);

    if (error) {
        return (
            <div className='codeBlock'>
                <span className='codeBlockLang'>mermaid (error)</span>
                <pre><code>{code}</code></pre>
            </div>
        );
    }

    return <div className='mermaidDiagram' ref={ref} />;
};

const BulletListBlock = ({ items }: { items: string[] }): JSX.Element => (
    <ul className='bulletList'>
        {items.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
        ))}
    </ul>
);

const BlockquoteBlock = ({ text }: { text: string }): JSX.Element => (
    <div className='blockquote' dangerouslySetInnerHTML={{ __html: formatInline(text) }} />
);

const SubsectionBlock = ({ title, content }: { title: string; content: LocalPlanContent[] }): JSX.Element => {
    const [open, setOpen] = useState(false);

    return (
        <div className='subsection'>
            <div className='subsectionHeading clickable' onClick={() => setOpen(!open)}>
                <span className={`sectionChevron ${open ? 'open' : ''}`}>▶</span>
                <h3>{title}</h3>
            </div>
            {open && (
                <div className='subsectionContent'>
                    {content.map((item, i) => (
                        <ContentBlock key={i} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
};

function formatInline(text: string): string {
    return text
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="link" title="$2">$1</span>');
}
