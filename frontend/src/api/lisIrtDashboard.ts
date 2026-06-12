import type {
  LisIrtDashboardFilters,
  LisIrtDashboardResponse,
} from "./types";
import { buildLisIrtDashboard } from "../mocks/lisIrtDashboardMock";

export const lisIrtDashboardApi = {
  async getDashboard(
    filters: LisIrtDashboardFilters = {},
  ): Promise<LisIrtDashboardResponse> {
    // TODO: Replace with a backend endpoint such as
    // GET /api/governance/lis-irt-dashboard once real LIS / IRT analytics
    // data is available from the service layer.
    return buildLisIrtDashboard(filters);
  },
};
