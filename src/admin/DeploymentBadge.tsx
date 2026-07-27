import { useQuery } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, LoaderCircle, Timer } from "lucide-react";
import { getDeployment } from "./api";

export default function DeploymentBadge({ commitSha }: { commitSha: string }) {
  const query = useQuery({
    queryKey: ["deployment", commitSha],
    queryFn: () => getDeployment(commitSha),
    enabled: Boolean(commitSha),
    refetchInterval: (query) => query.state.data?.found && ["READY", "ERROR", "CANCELED"].includes(query.state.data.state || "") ? false : 15_000,
    retry: 1,
  });

  if (!commitSha || query.isLoading) {
    return <span className="admin-status"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> 查询中</span>;
  }
  if (query.isError) return <span className="admin-status admin-status-error" title={query.error instanceof Error ? query.error.message : "未知错误"}><CircleAlert className="h-3.5 w-3.5" /> 查询失败</span>;
  if (!query.data?.found) return <span className="admin-status"><Timer className="h-3.5 w-3.5" /> 等待部署</span>;
  if (query.data.state === "READY") return <a className="admin-status admin-status-ready" href={query.data.deploymentUrl} target="_blank" rel="noreferrer"><CircleCheck className="h-3.5 w-3.5" /> 已部署</a>;
  if (["ERROR", "CANCELED"].includes(query.data.state || "")) {
    return <a className="admin-status admin-status-error" href={query.data.inspectorUrl || query.data.deploymentUrl} target="_blank" rel="noreferrer"><CircleAlert className="h-3.5 w-3.5" /> 部署失败</a>;
  }
  return <span className="admin-status"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> {query.data.state || "部署中"}</span>;
}
