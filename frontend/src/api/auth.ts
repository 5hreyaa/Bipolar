import { LoginResponse, User } from "../types";
import { apiRequest } from "./client";

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuthRedirect: true,
  });
}

export async function fetchCurrentUser(): Promise<User> {
  return apiRequest<User>("/auth/me");
}

