import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ComingSoonPage from "./pages/ComingSoonPage";
import DesignSystemPreview from "./pages/DesignSystemPreview";
import RequestDetailPage from "./pages/RequestDetailPage";
import RequestQueuePage from "./pages/RequestQueuePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/requests" replace />} />
        <Route path="/requests" element={<RequestQueuePage />} />
        <Route path="/requests/:id" element={<RequestDetailPage />} />
        <Route
          path="/governance"
          element={<ComingSoonPage title="Governance & Insights" />}
        />
        <Route
          path="/attention"
          element={<ComingSoonPage title="Work Needing Attention" />}
        />
        <Route path="/audit" element={<ComingSoonPage title="Audit" />} />
        <Route path="/settings" element={<ComingSoonPage title="Settings" />} />
        <Route path="/design-system" element={<DesignSystemPreview />} />
        <Route path="*" element={<Navigate to="/requests" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
