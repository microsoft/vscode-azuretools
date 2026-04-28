/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button, Spinner, Textarea } from '@fluentui/react-components';
import { CheckmarkRegular, CommentEditRegular, DismissRegular, SendRegular } from '@fluentui/react-icons';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { WebviewContext } from '../WebviewContext';
import '../styles/scaffoldPlanView.scss';
import { type PlanContent, type PlanData, type PlanSection, type TreeNode } from './utils/parseScaffoldPlanMarkdown';

const editableOptions: Record<string, string[]> = {
    'Runtime': ['TypeScript (Node.js)', 'Python', 'Java', '.NET (C#)', 'Go'],
    'Backend': ['Azure Functions v4 (Node.js v4 model)', 'Express.js', 'Fastify', 'Flask', 'FastAPI', 'Spring Boot', 'ASP.NET Core'],
    'Frontend': ['React + Vite', 'Next.js', 'Vue + Vite', 'Angular', 'Svelte', 'None'],
    'Package Manager': ['npm', 'yarn', 'pnpm'],
    'Test Runner': ['vitest', 'jest', 'mocha', 'pytest', 'JUnit'],
};

type CellKey = `${number}:${number}:${number}:${number}`;
const cellKey = (s: number, c: number, r: number, col: number): CellKey => `${s}:${c}:${r}:${col}`;

type FeedbackItem =
    | { id: string; kind: 'dropdown'; cell: CellKey; sectionIdx: number; contentIdx: number; rowIdx: number; colIdx: number; field: string; from: string; to: string }
    | { id: string; kind: 'freeform'; text: string };

let feedbackIdCounter = 0;
const nextId = (): string => `fb-${++feedbackIdCounter}`;

function buildFeedbackPrompt(items: FeedbackItem[], freeform: string): string {
    const changes = items
        .filter((i): i is Extract<FeedbackItem, { kind: 'dropdown' }> => i.kind === 'dropdown')
        .map(i => `- Change ${i.field} from ${i.from} to ${i.to}`);
    const notes = items
        .filter((i): i is Extract<FeedbackItem, { kind: 'freeform' }> => i.kind === 'freeform')
        .map(i => `- ${i.text.trim()}`)
        .filter(t => t.length > 2);

    const lines: string[] = [
        'Please revise the project plan based on my feedback and update project-plan.md.',
        'Keep existing sections unchanged unless a change below implies otherwise. Wait for my approval after updating the file.',
        '',
    ];
    if (changes.length > 0) {
        lines.push('Changes:', ...changes, '');
    }
    if (notes.length > 0) {
        lines.push('Additional notes:', ...notes, '');
    }
    if (freeform.trim().length > 0) {
        lines.push('Additional notes:', `- ${freeform.trim()}`, '');
    }
    return lines.join('\n').trimEnd();
}

export const ScaffoldPlanView = (): JSX.Element => {
    const [plan, setPlan] = useState<PlanData | null>(null);
    const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
    const [freeformDraft, setFreeformDraft] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [isAwaitingRevision, setIsAwaitingRevision] = useState(false);
    // Tracks the ORIGINAL plan cell value when first edited, keyed by cell position.
    // Used to revert cells when a dropdown feedback item is discarded or the
    // user selects the same value again.
    const originalCellValues = useRef<Map<CellKey, string>>(new Map());
    const { vscodeApi } = useContext(WebviewContext);

    const hasEdits = useMemo(
        () => feedbackItems.length > 0 || freeformDraft.trim().length > 0,
        [feedbackItems, freeformDraft],
    );
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (message?.command === 'setPlanData') {
                setPlan(message.data as PlanData);
                // New plan data from the controller — either the initial load or a
                // post-revision refresh. Either way, clear pending feedback state.
                setFeedbackItems([]);
                setFreeformDraft('');
                originalCellValues.current.clear();
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
            setDrawerOpen(true);
            return;
        }
        vscodeApi.postMessage({ command: 'approvePlan', data: plan });
    }, [plan, hasEdits, vscodeApi]);

    const mutateCell = useCallback((sectionIdx: number, contentIdx: number, rowIdx: number, colIdx: number, value: string) => {
        setPlan(prev => {
            if (!prev) {
                return prev;
            }
            const updated = structuredClone(prev);
            const content = updated.sections[sectionIdx]?.content[contentIdx];
            if (content?.type === 'table') {
                content.rows[rowIdx][colIdx] = value;
            }
            return updated;
        });
    }, []);
    const handleTableCellChange = useCallback((sectionIdx: number, contentIdx: number, rowIdx: number, colIdx: number, value: string) => {
        if (!plan) {
            return;
        }
        const content = plan.sections[sectionIdx]?.content[contentIdx];
        if (!content || content.type !== 'table') {
            return;
        }

        const key = cellKey(sectionIdx, contentIdx, rowIdx, colIdx);
        const currentCellValue = content.rows[rowIdx][colIdx];
        const field = content.rows[rowIdx][0];
        const original = originalCellValues.current.get(key) ?? currentCellValue;
        if (!originalCellValues.current.has(key)) {
            originalCellValues.current.set(key, currentCellValue);
        }

        mutateCell(sectionIdx, contentIdx, rowIdx, colIdx, value);

        setFeedbackItems(prev => {
            const existingIdx = prev.findIndex(i => i.kind === 'dropdown' && i.cell === key);
            // Back to original → drop the feedback item (and forget the original).
            if (value === original) {
                originalCellValues.current.delete(key);
                if (existingIdx >= 0) {
                    const next = prev.slice();
                    next.splice(existingIdx, 1);
                    return next;
                }
                return prev;
            }
            if (existingIdx >= 0) {
                const next = prev.slice();
                const existing = next[existingIdx];
                if (existing.kind === 'dropdown') {
                    next[existingIdx] = { ...existing, to: value };
                }
                return next;
            }
            return [
                ...prev,
                {
                    id: nextId(),
                    kind: 'dropdown',
                    cell: key,
                    sectionIdx, contentIdx, rowIdx, colIdx,
                    field,
                    from: original,
                    to: value,
                },
            ];
        });
    }, [plan, mutateCell]);

    const handleRemoveFeedback = useCallback((id: string) => {
        setFeedbackItems(prev => {
            const item = prev.find(i => i.id === id);
            if (item?.kind === 'dropdown') {
                mutateCell(item.sectionIdx, item.contentIdx, item.rowIdx, item.colIdx, item.from);
                originalCellValues.current.delete(item.cell);
            }
            return prev.filter(i => i.id !== id);
        });
    }, [mutateCell]);

    const handleAddNote = useCallback(() => {
        const text = freeformDraft.trim();
        if (!text) {
            return;
        }
        setFeedbackItems(prev => [...prev, { id: nextId(), kind: 'freeform', text }]);
        setFreeformDraft('');
    }, [freeformDraft]);

    const handleDiscardAll = useCallback(() => {
        // Revert any cells touched by dropdown feedback items.
        setFeedbackItems(prev => {
            for (const item of prev) {
                if (item.kind === 'dropdown') {
                    mutateCell(item.sectionIdx, item.contentIdx, item.rowIdx, item.colIdx, item.from);
                }
            }
            return [];
        });
        originalCellValues.current.clear();
        setFreeformDraft('');
    }, [mutateCell]);

    const handleSubmitFeedback = useCallback(() => {
        if (!plan || !hasEdits) {
            return;
        }
        const draftTrimmed = freeformDraft.trim();
        const items = draftTrimmed.length > 0
            ? [...feedbackItems, { id: nextId(), kind: 'freeform' as const, text: draftTrimmed }]
            : feedbackItems;
        const prompt = buildFeedbackPrompt(items, '');
        vscodeApi.postMessage({ command: 'submitPlanFeedback', prompt, data: plan });
        setIsAwaitingRevision(true);
        setDrawerOpen(false);
    }, [plan, hasEdits, feedbackItems, freeformDraft, vscodeApi]);

    if (!plan) {
        return <div className='scaffoldPlanView'><p>Loading plan...</p></div>;
    }

    const sections = plan.sections ?? [];
    const overviewSection = sections.find(s => s.number === 1);
    const detailSections = sections.filter(s => s.number === 2 || s.number === 3);
    const structureSection = sections.find(s => s.title.toLowerCase().includes('project structure'));

    return (
        <div className={`scaffoldPlanView ${drawerOpen ? 'drawerOpen' : ''} ${isAwaitingRevision ? 'revising' : ''}`}>
            <div className='planMain'>
                <div className='planHeader'>
                    <div className='headerTop'>
                        <div>
                            <h1>Project Plan</h1>
                            <div className='metadataBadges'>
                                <span className='badge'>{plan.status}</span>
                                <span className='badge subtle'>{plan.mode}</span>
                                <span className='created'>Created: {plan.created}</span>
                            </div>
                        </div>
                        <div className='headerActions'>
                            <Button
                                appearance='secondary'
                                icon={<CommentEditRegular />}
                                disabled={isAwaitingRevision}
                                onClick={() => setDrawerOpen(v => !v)}
                            >
                                Feedback{hasEdits ? ` (${feedbackItems.length + (freeformDraft.trim() ? 1 : 0)})` : ''}
                            </Button>
                            <Button
                                appearance='primary'
                                icon={hasEdits ? <CommentEditRegular /> : <CheckmarkRegular />}
                                disabled={isAwaitingRevision}
                                onClick={handleApprove}
                            >
                                {hasEdits ? 'Review & Submit' : 'Approve Plan'}
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

                {overviewSection && <OverviewCard section={overviewSection} />}

                <div className='sectionsRow'>
                    {detailSections.map((section) => {
                        const sectionIdx = sections.indexOf(section);
                        return (
                            <SectionCard
                                key={section.number}
                                section={section}
                                sectionIdx={sectionIdx}
                                disabled={isAwaitingRevision}
                                onTableCellChange={handleTableCellChange}
                            />
                        );
                    })}
                </div>

                {structureSection && <ProjectStructureCard section={structureSection} />}
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
                        Change any dropdown in the plan to capture a suggested edit here, or add a free-form note below.
                    </p>
                )}

                {items.length > 0 && (
                    <ul className='feedbackList'>
                        {items.map(item => (
                            <li key={item.id} className={`feedbackItem ${item.kind}`}>
                                {item.kind === 'dropdown' ? (
                                    <span className='feedbackChipText'>
                                        <strong>{item.field}:</strong> {item.from}
                                        <span className='arrow'> → </span>
                                        {item.to}
                                    </span>
                                ) : (
                                    <span className='feedbackFreeformText'>{item.text}</span>
                                )}
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
                        placeholder='Add a note for Copilot (e.g. "Prefer a monorepo layout")'
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

const OverviewCard = ({ section }: { section: PlanSection }): JSX.Element => {
    const goal = section.content?.find(c => c.type === 'keyValue' && c.key === 'Goal') as { type: 'keyValue'; key: string; value: string } | undefined;
    const appType = section.content?.find(c => c.type === 'keyValue' && c.key === 'App Type') as { type: 'keyValue'; key: string; value: string } | undefined;
    const mode = section.content?.find(c => c.type === 'keyValue' && c.key === 'Mode') as { type: 'keyValue'; key: string; value: string } | undefined;
    const tables = section.content?.filter(c => c.type === 'table') ?? [];

    return (
        <div className='sectionCard overviewWrapper'>
            <h2>Overview</h2>
            {goal && <p className='goalText'>{goal.value}</p>}
            <div className='overviewMeta'>
                {appType && (
                    <div className='metaItem'>
                        <span className='metaLabel'>App Type</span>
                        <span className='metaValue'>{appType.value}</span>
                    </div>
                )}
                {mode && (
                    <div className='metaItem'>
                        <span className='metaLabel'>Mode</span>
                        <span className='metaValue'>{mode.value}</span>
                    </div>
                )}
            </div>
            {tables.length > 0 && tables.map((item, i) => {
                if (item.type !== 'table') { return null; }
                return (
                    <div key={i} className='overviewTableWrapper'>
                        <table className='planTable'>
                            <thead>
                                <tr>{item.headers.map((h, hi) => <th key={hi}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {item.rows.map((row, ri) => (
                                    <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
};

interface SectionCardProps {
    section: PlanSection;
    sectionIdx: number;
    disabled?: boolean;
    onTableCellChange: (sectionIdx: number, contentIdx: number, rowIdx: number, colIdx: number, value: string) => void;
}

const SectionCard = ({ section, sectionIdx, disabled, onTableCellChange }: SectionCardProps): JSX.Element => (
    <div className='sectionCard'>
        <h2>{section.title}</h2>
        <div className='sectionContent'>
            {(section.content ?? []).map((item, contentIdx) => (
                <ContentBlock
                    key={contentIdx}
                    item={item}
                    sectionIdx={sectionIdx}
                    contentIdx={contentIdx}
                    disabled={disabled}
                    onTableCellChange={onTableCellChange}
                />
            ))}
        </div>
    </div>
);

const ProjectStructureCard = ({ section }: { section: PlanSection }): JSX.Element => {
    const treeContent = section.content?.find(c => c.type === 'tree');

    if (!treeContent || treeContent.type !== 'tree') {
        return <div className='sectionCard'><h2>{section.title}</h2><p className='paragraph'>No structure found.</p></div>;
    }

    return (
        <div className='sectionCard'>
            <h2>{section.title}</h2>
            <div className='treeView'>
                <TreeNodeItem node={{ name: treeContent.root, isFolder: true, children: treeContent.nodes }} depth={0} defaultOpen={true} />
            </div>
        </div>
    );
};

const TreeNodeItem = ({ node, depth, defaultOpen }: { node: TreeNode; depth: number; defaultOpen?: boolean }): JSX.Element => {
    const [open, setOpen] = useState(defaultOpen ?? depth < 1);
    const hasChildren = node.children.length > 0;

    return (
        <div className='treeNode'>
            <div
                className={`treeRow ${hasChildren ? 'clickable' : ''}`}
                style={{ paddingLeft: `${depth * 16}px` }}
                onClick={() => hasChildren && setOpen(!open)}
            >
                {hasChildren ? (
                    <span className={`treeChevron ${open ? 'open' : ''}`}>▶</span>
                ) : (
                    <span className='treeChevronSpacer' />
                )}
                <span className={`treeIcon codicon ${node.isFolder ? 'codicon-folder' : 'codicon-file'}`} />
                <span className='treeName'>{node.name}</span>
                {node.comment && <span className='treeComment'>{node.comment}</span>}
            </div>
            {open && hasChildren && (
                <div className='treeChildren'>
                    {node.children.map((child, i) => (
                        <TreeNodeItem key={i} node={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

interface ContentBlockProps {
    item: PlanContent;
    sectionIdx: number;
    contentIdx: number;
    disabled?: boolean;
    onTableCellChange: (sectionIdx: number, contentIdx: number, rowIdx: number, colIdx: number, value: string) => void;
}

const ContentBlock = ({ item, sectionIdx, contentIdx, disabled, onTableCellChange }: ContentBlockProps): JSX.Element => {
    switch (item.type) {
        case 'keyValue':
            return (
                <div className='keyValue'>
                    <span className='key'>{item.key}</span>
                    <span className='value'>{item.value}</span>
                </div>
            );
        case 'table':
            return (
                <table className='planTable'>
                    <thead>
                        <tr>
                            {item.headers.map((h, i) => <th key={i}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {item.rows.map((row, ri) => (
                            <tr key={ri}>
                                {row.map((cell, ci) => {
                                    const componentName = row[0];
                                    const options = ci > 0 ? editableOptions[componentName] : undefined;
                                    return (
                                        <td key={ci}>
                                            {options ? (
                                                <select
                                                    className='cellDropdown'
                                                    value={cell}
                                                    disabled={disabled}
                                                    onChange={(e) => onTableCellChange(sectionIdx, contentIdx, ri, ci, e.target.value)}
                                                >
                                                    {!options.includes(cell) && <option value={cell}>{cell}</option>}
                                                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            ) : cell}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        case 'blockquote':
            return <div className='blockquote'>{item.text}</div>;
        case 'paragraph':
            return <p className='paragraph'>{item.text}</p>;
        case 'tree':
            return <div />;
    }
};
