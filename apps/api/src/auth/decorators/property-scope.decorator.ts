import { SetMetadata } from "@nestjs/common";

/**
 * @PropertyScope decorator — tells PropertyScopeGuard how to derive
 * the property from the current request's route parameters.
 *
 * Usage:
 *   @PropertyScope('property')  — route has :propertyId param
 *   @PropertyScope('unit')      — route has :unitId param; guard looks up unit.property_id
 *   @PropertyScope('lease')     — route has :id (leaseId); guard looks up lease → unit → property
 *   @PropertyScope('tenant')    — route has :id (tenantId); guard looks up via active lease
 *
 * Phase 3 implementation is in PropertyScopeGuard.
 */
export const PROPERTY_SCOPE_KEY = "property_scope";
export type PropertyScopeType = "property" | "unit" | "lease" | "tenant";

export const PropertyScope = (type: PropertyScopeType) =>
  SetMetadata(PROPERTY_SCOPE_KEY, type);
