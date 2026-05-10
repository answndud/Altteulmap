import { Route, Routes } from "react-router-dom";

import { AdminDashboardRoute } from "@/client/routes/admin/AdminDashboardRoute";
import { AdminPlacePricesRoute } from "@/client/routes/admin/AdminPlacePricesRoute";
import { AdminPlacesRoute } from "@/client/routes/admin/AdminPlacesRoute";
import { AdminPricesRoute } from "@/client/routes/admin/AdminPricesRoute";
import { AdminReportsRoute } from "@/client/routes/admin/AdminReportsRoute";

export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<AdminDashboardRoute />} />
      <Route path="places" element={<AdminPlacesRoute />} />
      <Route path="prices" element={<AdminPricesRoute />} />
      <Route path="prices/places/:id" element={<AdminPlacePricesRoute />} />
      <Route path="reports" element={<AdminReportsRoute />} />
    </Routes>
  );
}
