import { apiClient } from './client';

export interface SignupPayload {
  full_name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface SignupResponse {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export async function signup(payload: SignupPayload): Promise<SignupResponse> {
  const res = await apiClient.post<SignupResponse>('/auth/signup', payload);
  return res.data;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/login', payload);
  return res.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}
