import type { Session, WorkflowStatus, Message } from './types';

export const MOCK_SESSIONS: Session[] = [
  {
    session_id: 'sess_001',
    company_name: 'Acme Corp',
    company_website: 'https://acme.com',
    research_objective: 'Understand their product offerings before a discovery call',
    status: 'complete',
    created_at: '2026-06-15T10:00:00Z',
    updated_at: '2026-06-15T10:05:00Z',
    report: {
      company_overview:
        'Acme Corp is a B2B SaaS company founded in 2018, headquartered in San Francisco. They provide enterprise workflow automation tools focused on mid-market sales teams. The company has raised $45M in Series B funding as of January 2026 and employs approximately 320 people globally.',
      products_services:
        "Their flagship product, Acme Flow, is a no-code workflow automation platform. They also offer Acme Insights, a real-time analytics dashboard, and Acme Connect, an API integration layer that connects to 200+ tools. Pricing ranges from $49/seat/month for Starter to enterprise custom pricing.",
      target_customers:
        'Mid-market B2B companies with 50–500 employees, specifically sales operations managers and RevOps teams. Primary verticals include SaaS, fintech, and professional services. Average deal size is $24k ARR.',
      business_signals:
        'Series B raised January 2026 ($30M led by Sequoia). Actively hiring 40 AEs and 12 SDRs (LinkedIn, Jan 2026). Launched a new partner ecosystem in Q4 2025. CEO publicly stated Q1 2026 target of doubling enterprise customer count.',
      risks_challenges:
        'Heavy competition from Zapier and Make.com in the SMB segment. Their enterprise features are newer and less mature. Customer reviews mention a steep learning curve for non-technical users. Dependent on Salesforce ecosystem — Salesforce changes could impact integrations.',
      discovery_questions: [
        'How are you currently managing workflow automation across your sales team?',
        'What does your current RevOps stack look like, and where are the biggest integration pain points?',
        'With the new AE hires, how are you thinking about onboarding and ramping efficiency?',
        'Are you evaluating any alternatives to your current workflow tooling?',
      ],
      outreach_strategy:
        'Lead with the ROI angle around AE ramp time reduction — the 40 new AE hires signal scaling pain. Reference the Series B as a trigger: "Congrats on the funding — companies at this stage often find their tooling doesn\'t scale with the team." Position as a solution that their RevOps team can deploy without engineering. Request a discovery call with the VP of Sales Ops.',
      unknowns:
        'Could not determine current ARR or precise pricing model details. Churn rate and NPS not publicly available. Unclear whether the $30M Series B is fully deployed or still on the balance sheet.',
      sources: [
        'https://acme.com/about',
        'https://techcrunch.com/2026/01/acme-series-b',
        'https://linkedin.com/company/acmecorp/jobs',
        'https://g2.com/products/acme-flow/reviews',
      ],
    },
  },
  {
    session_id: 'sess_002',
    company_name: 'Xempla',
    company_website: 'https://xempla.io',
    research_objective: 'Evaluate fit for our enterprise tier partnership',
    status: 'running',
    created_at: '2026-06-16T09:00:00Z',
    updated_at: '2026-06-16T09:02:00Z',
    report: null,
  },
  {
    session_id: 'sess_003',
    company_name: 'Flytbase',
    company_website: 'https://flytbase.com',
    research_objective: 'Competitive analysis for drone software market',
    status: 'failed',
    created_at: '2026-06-14T14:00:00Z',
    updated_at: '2026-06-14T14:08:00Z',
    report: null,
  },
];

export const MOCK_WORKFLOW_STATUS: WorkflowStatus = {
  session_id: 'sess_002',
  status: 'running',
  started_at: '2026-06-16T09:00:05Z',
  completed_at: null,
  error_message: null,
  nodes: [
    {
      node_name: 'intent_parser',
      status: 'complete',
      started_at: '2026-06-16T09:00:06Z',
      output: { search_queries: ['Xempla drone software', 'Xempla funding 2025'] },
      error: null,
    },
    {
      node_name: 'web_searcher',
      status: 'complete',
      started_at: '2026-06-16T09:00:09Z',
      output: { result_count: 8 },
      error: null,
    },
    {
      node_name: 'website_scraper',
      status: 'complete',
      started_at: '2026-06-16T09:00:09Z',
      output: { pages_scraped: 4 },
      error: null,
    },
    {
      node_name: 'data_merger',
      status: 'complete',
      started_at: '2026-06-16T09:00:18Z',
      output: null,
      error: null,
    },
    {
      node_name: 'gap_detector',
      status: 'running',
      started_at: '2026-06-16T09:00:22Z',
      output: null,
      error: null,
    },
    {
      node_name: 'insight_extractor',
      status: 'pending',
      started_at: null,
      output: null,
      error: null,
    },
    {
      node_name: 'report_compiler',
      status: 'pending',
      started_at: null,
      output: null,
      error: null,
    },
    {
      node_name: 'quality_validator',
      status: 'pending',
      started_at: null,
      output: null,
      error: null,
    },
    {
      node_name: 'finalizer',
      status: 'pending',
      started_at: null,
      output: null,
      error: null,
    },
  ],
};

export const MOCK_MESSAGES: Message[] = [
  {
    message_id: 'msg_001',
    role: 'user',
    content: 'What is their main product?',
    created_at: '2026-06-15T10:10:00Z',
  },
  {
    message_id: 'msg_002',
    role: 'assistant',
    content:
      "Acme Corp's main product is **Acme Flow**, a no-code workflow automation platform designed for sales and RevOps teams. It allows users to build automated workflows without any coding, connecting to over 200 tools via their Acme Connect API integration layer. They also offer Acme Insights for real-time analytics. Their pricing starts at $49/seat/month for the Starter tier, with enterprise custom pricing available.",
    created_at: '2026-06-15T10:10:03Z',
  },
  {
    message_id: 'msg_003',
    role: 'user',
    content: 'What are the key risks I should know about before the call?',
    created_at: '2026-06-15T10:11:00Z',
  },
  {
    message_id: 'msg_004',
    role: 'assistant',
    content:
      'Based on the research, here are the key risks to be aware of:\n\n1. **Competitive pressure** — They face stiff competition from Zapier and Make.com, especially in SMB. Your pitch will likely need to differentiate from these incumbents.\n\n2. **Enterprise maturity** — Their enterprise features are newer and less battle-tested, which may be a concern if your prospect is risk-averse.\n\n3. **Learning curve** — Customer reviews cite complexity for non-technical users, which could be a blocker for adoption if the sales team isn\'t technical.\n\n4. **Salesforce dependency** — Their integrations lean heavily on Salesforce. If your prospect is on HubSpot or another CRM, verify compatibility early.',
    created_at: '2026-06-15T10:11:05Z',
  },
];
