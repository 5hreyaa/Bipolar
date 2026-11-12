import { ScannerInfoResponse, ScannerPredictResponse } from "../types";
import { apiRequest } from "./client";

export async function fetchScannerInfo(): Promise<ScannerInfoResponse> {
  return apiRequest<ScannerInfoResponse>("/scanner/info");
}

export async function predictSnackCategory(file: File): Promise<ScannerPredictResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<ScannerPredictResponse>("/scanner/predict", {
    method: "POST",
    body: formData,
  });
}

