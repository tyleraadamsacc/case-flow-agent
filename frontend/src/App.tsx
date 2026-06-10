import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AuditPage from "./pages/AuditPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import DesignSystemPreview from "./pages/DesignSystemPreview";
import GovernanceInsightsPage from "./pages/GovernanceInsightsPage";
import RequestDetailPage from "./pages/RequestDetailPage";
import RequestQueuePage from "./pages/RequestQueuePage";
import WorkNeedingAttentionPage from "./pages/WorkNeedingAttentionPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/governance" replace />} />
        <Route path="/governance" element={<GovernanceInsightsPage />} />
        <Route path="/attention" element={<WorkNeedingAttentionPage />} />
        <Route path="/requests" element={<RequestQueuePage />} />
        <Route path="/requests/:id" element={<RequestDetailPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/settings" element={<ComingSoonPage title="Settings" />} />
        <Route path="/design-system" element={<DesignSystemPreview />} />
        <Route path="*" element={<Navigate to="/governance" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
