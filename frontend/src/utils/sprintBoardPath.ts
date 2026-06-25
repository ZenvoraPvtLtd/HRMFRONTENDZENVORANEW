/** Resolve sprint-board base path for the current portal (HR / employee / manager / admin). */
export function getSprintBoardBasePath(pathname: string): string {
  if (pathname.startsWith("/admin")) return "/admin/sprint-board";
  if (pathname.startsWith("/manager")) return "/manager/sprint-board";
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/employeedashboard")) {
    return "/dashboard/sprint-board";
  }
  return "/sprint-board";
}

/** Parent route prefix for portal-scoped navigation (timesheet, sprint-board, etc.). */
export function getPortalBasePath(pathname: string): string {
  const sprintBase = getSprintBoardBasePath(pathname);
  return sprintBase === "/sprint-board" ? "" : sprintBase.replace(/\/sprint-board$/, "");
}
