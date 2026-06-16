export type SessionStatus = 'pending' | 'running' | 'complete' | 'failed';
export type NodeStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface ReportContent {
  company_overview: string;
  products_services: string;
  target_customers: string;
  business_signals: string;
  risks_challenges: string;
  discovery_questions: string[];
  outreach_strategy: string;
  unknowns: string;
  sources: string[];
}

export interface WorkflowNode {
  node_name: string;
  status: NodeStatus;
  started_at: string | null;
  output: Record<string, unknown> | null;
  error: string | null;
}

export interface Session {
  session_id: string;
  company_name: string;
  company_website: string;
  research_objective: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  report?: ReportContent | null;
}

export interface Message {
  message_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface WorkflowStatus {
  session_id: string;
  status: SessionStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  nodes: WorkflowNode[];
}
