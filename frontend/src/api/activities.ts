import { ActivityAction, ActivityListResponse } from "../types";
import { apiRequest } from "./client";

export interface ActivityQueryParams {
  page?: number;
  per_page?: number;
  snack_id?: number;
  action?: ActivityAction | "";
}

export async function fetchActivities(
  params: ActivityQueryParams = {}
): Promise<ActivityListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page));
  if (params.snack_id) qs.set("snack_id", String(params.snack_id));
  if (params.action) qs.set("action", params.action);

  const queryString = qs.toString();
  return apiRequest<ActivityListResponse>(
    `/activities${queryString ? `?${queryString}` : ""}`
  );
}

