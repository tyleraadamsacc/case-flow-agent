/** Typed fetch client for the CaseFlow backend. All endpoints are
 * draft/prepare/review operations — the backend has no send, release,
 * or disclosure endpoint, and this client must never grow one. */

import type {
  ActionResponse,
  AgentRun,
  ApproveResponse,
  AuditEvent,
  DraftRunResponse,
  ExtractResponse,
  LegalRequest,
  ProductionPackage,
  RailRunResponse,
  ResponsiveRecord,
  ReviewBody,
  ReviewResponse,
  ValidateResponse,
} from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `Request failed (${status})`);
    this.status = status;
    this.detail = detail;
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    let detail: unknown = response.statusText;
    try {
      const body = (await response.json()) as { detail?: unknown };
      detail = body.detail ?? body;
    } catch {
      // non-JSON error body — keep the status text
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

const BASE = "/api/legal-requests";

export const api = {
  listLegalRequests: () => http<LegalRequest[]>(BASE),

  getLegalRequest: (id: string) =>
    http<LegalRequest>(`${BASE}/${encodeURIComponent(id)}`),

  extract: (id: string) =>
    http<ExtractResponse>(`${BASE}/${encodeURIComponent(id)}/extract`, {
      method: "POST",
    }),

  validate: (id: string) =>
    http<ValidateResponse>(`${BASE}/${encodeURIComponent(id)}/validate`, {
      method: "POST",
    }),

  runAgentRail: (id: string) =>
    http<RailRunResponse>(`${BASE}/${encodeURIComponent(id)}/agents/run`, {
      method: "POST",
    }),

  listAgentRuns: (id: string) =>
    http<AgentRun[]>(`${BASE}/${encodeURIComponent(id)}/agent-runs`),

  listResponsiveRecords: (id: string) =>
    http<ResponsiveRecord[]>(
      `${BASE}/${encodeURIComponent(id)}/responsive-records`,
    ),

  getProductionPackage: (id: string) =>
    http<ProductionPackage>(
      `${BASE}/${encodeURIComponent(id)}/production-package`,
    ),

  draftProductionPackage: (id: string) =>
    http<DraftRunResponse>(
      `${BASE}/${encodeURIComponent(id)}/production-package/draft`,
      { method: "POST" },
    ),

  draftDeficiencyResponse: (id: string) =>
    http<DraftRunResponse>(
      `${BASE}/${encodeURIComponent(id)}/deficiency-response/draft`,
      { method: "POST" },
    ),

  review: (id: string, body: ReviewBody) =>
    http<ReviewResponse>(`${BASE}/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  approve: (id: string, body: { target_type?: string; comments?: string }) =>
    http<ApproveResponse>(`${BASE}/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  escalate: (id: string, body: { reason: string; target?: string }) =>
    http<ActionResponse>(`${BASE}/${encodeURIComponent(id)}/escalate`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  sendToQa: (id: string, body: { reason?: string } = {}) =>
    http<ActionResponse>(`${BASE}/${encodeURIComponent(id)}/send-to-qa`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  auditTimeline: (id: string) =>
    http<AuditEvent[]>(`${BASE}/${encodeURIComponent(id)}/audit`),
};

export type Api = typeof api;

import type {
  AgentActivityResponse,
  AuditEventFilters,
  AuditReadinessReport,
  GovernanceSummaryResponse,
  WorkNeedingAttentionResponse,
} from "./types";
import type { AuditEvent as AuditEventType } from "./types";

const GOVERNANCE = "/api/governance";

/** Governance & audit read models — reporting only; nothing here can
 * change workflow state. */
export const governanceApi = {
  summary: () => http<GovernanceSummaryResponse>(`${GOVERNANCE}/summary`),

  agentActivity: () =>
    http<AgentActivityResponse>(`${GOVERNANCE}/agent-activity`),

  workNeedingAttention: () =>
    http<WorkNeedingAttentionResponse>(`${GOVERNANCE}/work-needing-attention`),

  productVolume: () =>
    http<GovernanceSummaryResponse>(`${GOVERNANCE}/product-volume`),

  processingTimeByProduct: () =>
    http<GovernanceSummaryResponse>(`${GOVERNANCE}/processing-time-by-product`),

  bottlenecks: () =>
    http<GovernanceSummaryResponse>(`${GOVERNANCE}/bottlenecks`),

  auditReadiness: () =>
    http<AuditReadinessReport>(`${GOVERNANCE}/audit-readiness`),

  responsePackageStatus: () =>
    http<GovernanceSummaryResponse>(`${GOVERNANCE}/response-package-status`),

  auditEvents: (filters: AuditEventFilters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params.set(key, value);
      }
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return http<AuditEventType[]>(`/api/audit/events${suffix}`);
  },
};
