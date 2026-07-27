import { useOutletContext } from "react-router-dom";
import type { AdminSession } from "./types";

export interface AdminContext {
  session: AdminSession & { authenticated: true; csrfToken: string };
}

export function useAdminContext() {
  return useOutletContext<AdminContext>();
}
