import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { PlanEnforcementBanner } from "./PlanEnforcementBanner";
import { NotificationBell } from "./NotificationBell";

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-auto bg-gray-50">
        <PlanEnforcementBanner />
        <div className="flex items-center justify-end border-b border-gray-100 bg-white px-6 py-2">
          <NotificationBell />
        </div>
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
