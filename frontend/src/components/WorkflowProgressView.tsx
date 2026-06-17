import { useNavigate } from 'react-router-dom';
import type { WorkflowStatus } from '../types';
import { CheckCircle, XCircle, Circle, Loader } from 'lucide-react';

const NODE_DISPLAY_NAMES: Record<string, string> = {
  intent_parser: 'Intent Parser',
  web_searcher: 'Web Searcher',
  website_scraper: 'Website Scraper',
  data_merger: 'Data Merger',
  gap_detector: 'Gap Detector',
  targeted_researcher: 'Targeted Researcher',
  insight_extractor: 'Insight Extractor',
  report_compiler: 'Report Compiler',
  quality_validator: 'Quality Validator',
  finalizer: 'Finalizer',
};

const PARALLEL_PAIR = ['web_searcher', 'website_scraper'];

interface NodeIconProps {
  status: string;
}

function NodeIcon({ status }: NodeIconProps) {
  switch (status) {
    case 'complete':
      return <CheckCircle size={18} style={{ color: '#4ade80' }} />;
    case 'failed':
      return <XCircle size={18} style={{ color: '#f87171' }} />;
    case 'running':
      return (
        <Loader
          size={18}
          style={{ color: '#d97757' }}
          className="animate-spin"
        />
      );
    default:
      return <Circle size={18} style={{ color: '#9b9b97' }} />;
  }
}

function nodeRingStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'complete':
      return { border: '2px solid #4ade80', backgroundColor: '#4ade8015' };
    case 'failed':
      return { border: '2px solid #f87171', backgroundColor: '#f8717115' };
    case 'running':
      return {
        border: '2px solid #d97757',
        backgroundColor: '#d9775715',
        boxShadow: '0 0 0 3px #d9775730',
      };
    default:
      return { border: '2px solid #3a3a3a', backgroundColor: 'transparent' };
  }
}

interface WorkflowProgressViewProps {
  workflowStatus: WorkflowStatus;
  errorMessage?: string | null;
}

export function WorkflowProgressView({ workflowStatus, errorMessage }: WorkflowProgressViewProps) {
  const navigate = useNavigate();
  const nodes = workflowStatus.nodes;

  // Group into visual rows: parallel pair is one row, rest are individual rows
  type Row = { type: 'single'; node_name: string } | { type: 'parallel'; nodes: string[] };
  const rows: Row[] = [];
  let i = 0;
  while (i < nodes.length) {
    if (
      i + 1 < nodes.length &&
      PARALLEL_PAIR.includes(nodes[i].node_name) &&
      PARALLEL_PAIR.includes(nodes[i + 1].node_name)
    ) {
      rows.push({ type: 'parallel', nodes: [nodes[i].node_name, nodes[i + 1].node_name] });
      i += 2;
    } else {
      rows.push({ type: 'single', node_name: nodes[i].node_name });
      i++;
    }
  }

  function getNodeStatus(name: string) {
    return nodes.find(n => n.node_name === name)?.status ?? 'pending';
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
      <div className="w-full max-w-xs">
        <h3 className="text-sm font-medium mb-6 text-center" style={{ color: '#9b9b97' }}>
          Research in progress…
        </h3>

        <div className="flex flex-col items-center gap-0">
          {rows.map((row, idx) => (
            <div key={idx} className="flex flex-col items-center w-full">
              {/* Node row */}
              {row.type === 'single' ? (
                <div
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl w-full"
                  style={nodeRingStyle(getNodeStatus(row.node_name))}
                >
                  <NodeIcon status={getNodeStatus(row.node_name)} />
                  <span
                    className="text-sm font-mono"
                    style={{
                      color:
                        getNodeStatus(row.node_name) === 'pending' ? '#9b9b97' : '#e8e8e6',
                    }}
                  >
                    {NODE_DISPLAY_NAMES[row.node_name] ?? row.node_name}
                  </span>
                </div>
              ) : (
                <div className="flex gap-3 w-full justify-center">
                  {row.nodes.map(name => (
                    <div
                      key={name}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl flex-1"
                      style={nodeRingStyle(getNodeStatus(name))}
                    >
                      <NodeIcon status={getNodeStatus(name)} />
                      <span
                        className="text-xs font-mono truncate"
                        style={{
                          color: getNodeStatus(name) === 'pending' ? '#9b9b97' : '#e8e8e6',
                        }}
                      >
                        {NODE_DISPLAY_NAMES[name] ?? name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Connector arrow (not after last) */}
              {idx < rows.length - 1 && (
                <div className="flex flex-col items-center my-1">
                  <div style={{ width: '2px', height: '16px', backgroundColor: '#3a3a3a' }} />
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: '6px solid #3a3a3a',
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {errorMessage && (
          <div
            className="mt-6 px-4 py-3 rounded-lg text-sm"
            style={{ backgroundColor: '#f8717120', border: '1px solid #f87171', color: '#f87171' }}
          >
            {errorMessage}
          </div>
        )}

        {workflowStatus.status === 'failed' && (
          <button
            onClick={() => navigate('/sessions/new')}
            className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium cursor-pointer"
            style={{ backgroundColor: '#3a3a3a', color: '#e8e8e6' }}
          >
            Start New Session
          </button>
        )}
      </div>
    </div>
  );
}
