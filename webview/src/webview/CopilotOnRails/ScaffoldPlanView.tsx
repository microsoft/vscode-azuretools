/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button } from '@fluentui/react-components';
import { CheckmarkRegular, EditRegular } from '@fluentui/react-icons';
import { useCallback, useContext, useEffect, useState, type JSX } from 'react';
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

export const ScaffoldPlanView = (): JSX.Element => {
    const [plan, setPlan] = useState<PlanData | null>(null);
    const [hasEdits, setHasEdits] = useState(false);
    const { vscodeApi } = useContext(WebviewContext);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (message?.command === 'setPlanData') {
                setPlan(message.data as PlanData);
            }
        };
        window.addEventListener('message', handler);
        vscodeApi.postMessage({ command: 'ready' });
        return () => window.removeEventListener('message', handler);
    }, []);

    const handleApprove = useCallback(() => {
        if (plan) {
            vscodeApi.postMessage({ command: hasEdits ? 'editPlan' : 'approvePlan', data: plan });
        }
    }, [plan, hasEdits, vscodeApi]);

    const handleTableCellChange = useCallback((sectionIdx: number, contentIdx: number, rowIdx: number, colIdx: number, value: string) => {
        setHasEdits(true);
        setPlan(prev => {
            if (!prev) { return prev; }
            const updated = structuredClone(prev);
            const content = updated.sections[sectionIdx]?.content[contentIdx];
            if (content?.type === 'table') {
                content.rows[rowIdx][colIdx] = value;
            }
            return updated;
        });
    }, []);

    if (!plan) {
        return <div className='scaffoldPlanView'><p>Loading plan...</p></div>;
    }

    const sections = plan.sections ?? [];
    const overviewSection = sections.find(s => s.number === 1);
    const detailSections = sections.filter(s => s.number === 2 || s.number === 3);
    const structureSection = sections.find(s => s.title.toLowerCase().includes('project structure'));

    return (
        <div className='scaffoldPlanView'>
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
                    <Button
                        appearance='primary'
                        icon={hasEdits ? <EditRegular /> : <CheckmarkRegular />}
                        onClick={handleApprove}
                    >
                        {hasEdits ? 'Edit Plan' : 'Approve Plan'}
                    </Button>
                </div>
            </div>

            {overviewSection && <OverviewCard section={overviewSection} />}

            <div className='sectionsRow'>
                {detailSections.map((section) => {
                    const sectionIdx = sections.indexOf(section);
                    return (
                        <SectionCard
                            key={section.number}
                            section={section}
                            sectionIdx={sectionIdx}
                            onTableCellChange={handleTableCellChange}
                        />
                    );
                })}
            </div>

            {structureSection && <ProjectStructureCard section={structureSection} />}
        </div>
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
    onTableCellChange: (sectionIdx: number, contentIdx: number, rowIdx: number, colIdx: number, value: string) => void;
}

const SectionCard = ({ section, sectionIdx, onTableCellChange }: SectionCardProps): JSX.Element => (
    <div className='sectionCard'>
        <h2>{section.title}</h2>
        <div className='sectionContent'>
            {(section.content ?? []).map((item, contentIdx) => (
                <ContentBlock
                    key={contentIdx}
                    item={item}
                    sectionIdx={sectionIdx}
                    contentIdx={contentIdx}
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
    onTableCellChange: (sectionIdx: number, contentIdx: number, rowIdx: number, colIdx: number, value: string) => void;
}

const ContentBlock = ({ item, sectionIdx, contentIdx, onTableCellChange }: ContentBlockProps): JSX.Element => {
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
