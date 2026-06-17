import { apiClient } from './client';
import type { Session, WorkflowStatus, ReportContent } from '../types';

export interface CreateSessionPayload {
  company_name: string;
  company_website: string;
  research_objective: string;
}

export interface WorkflowRunResponse {
  session_id: string;
  status: string;
  message: string;
}

export interface ReportResponse {
  session_id: string;
  generated_at: string;
  content: ReportContent;
}

export async function createSession(payload: CreateSessionPayload): Promise<Session> {
  const res = await apiClient.post<Session>('/sessions', payload);
  return res.data;
}

export async function getSessions(): Promise<Session[]> {
  const res = await apiClient.get<Session[]>('/sessions');
  return res.data;
}

export async function getSession(sessionId: string): Promise<Session> {
  const res = await apiClient.get<Session>(`/sessions/${sessionId}`);
  return res.data;
}

export async function runWorkflow(sessionId: string): Promise<WorkflowRunResponse> {
  const res = await apiClient.post<WorkflowRunResponse>(`/sessions/${sessionId}/run`);
  return res.data;
}

export async function getWorkflowStatus(sessionId: string): Promise<WorkflowStatus> {
  const res = await apiClient.get<WorkflowStatus>(`/sessions/${sessionId}/status`);
  return res.data;
}

export async function getReport(sessionId: string): Promise<ReportResponse> {
  const res = await apiClient.get<ReportResponse>(`/sessions/${sessionId}/report`);
  return res.data;
}
