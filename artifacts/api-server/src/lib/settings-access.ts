import type { RequestHandler } from "express";
import {
  createRequireRole,
  resolveUserRole,
  type UserRoleResolver,
} from "./roles";

export function createRequireSettingsAdmin(
  resolveRole: UserRoleResolver = resolveUserRole,
): RequestHandler {
  return createRequireRole(resolveRole)("admin");
}

export const requireSettingsAdmin = createRequireSettingsAdmin();
