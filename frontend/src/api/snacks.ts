import {
  ConsumeResponse,
  ImageUploadResponse,
  RestockResponse,
  Snack,
  SnackCategory,
  SnackCreateInput,
  SnackListResponse,
  SnackStatus,
  SnackSummary,
  SnackUpdateInput,
  VoteResponse,
} from "../types";
import { apiRequest } from "./client";

export interface SnackQueryParams {
  search?: string;
  category?: SnackCategory | "";
  status?: SnackStatus | "";
  sort_by?: "name" | "quantity" | "votes" | "created_at";
  sort_order?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

export async function fetchSnacks(params: SnackQueryParams = {}): Promise<SnackListResponse> {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.category) qs.set("category", params.category);
  if (params.status) qs.set("status", params.status);
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  if (params.sort_order) qs.set("sort_order", params.sort_order);
  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page));

  const queryString = qs.toString();
  return apiRequest<SnackListResponse>(`/snacks${queryString ? `?${queryString}` : ""}`);
}

export async function fetchSnackSummary(): Promise<SnackSummary> {
  return apiRequest<SnackSummary>("/snacks/summary");
}

export async function fetchSnackById(id: number): Promise<Snack> {
  return apiRequest<Snack>(`/snacks/${id}`);
}

export async function createSnack(payload: SnackCreateInput): Promise<Snack> {
  return apiRequest<Snack>("/snacks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSnack(id: number, payload: SnackUpdateInput): Promise<Snack> {
  return apiRequest<Snack>(`/snacks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSnack(id: number): Promise<{ message: string; deleted_id: number }> {
  return apiRequest<{ message: string; deleted_id: number }>(`/snacks/${id}`, {
    method: "DELETE",
  });
}

export async function consumeSnack(id: number, amount = 1): Promise<ConsumeResponse> {
  return apiRequest<ConsumeResponse>(`/snacks/${id}/consume`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function restockSnack(id: number, amount: number): Promise<RestockResponse> {
  return apiRequest<RestockResponse>(`/snacks/${id}/restock`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function voteSnack(id: number): Promise<VoteResponse> {
  return apiRequest<VoteResponse>(`/snacks/${id}/vote`, {
    method: "POST",
  });
}

export async function unvoteSnack(id: number): Promise<VoteResponse> {
  return apiRequest<VoteResponse>(`/snacks/${id}/vote`, {
    method: "DELETE",
  });
}

export async function uploadSnackImage(file: File): Promise<ImageUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<ImageUploadResponse>("/snacks/upload-image", {
    method: "POST",
    body: formData,
  });
}

