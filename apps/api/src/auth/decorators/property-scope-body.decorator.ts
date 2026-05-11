import { SetMetadata } from "@nestjs/common";

/**
 * @PropertyScopeBody decorator — tells PropertyScopeGuard to derive the property
 * from a named field in the request BODY rather than from a route parameter.
 *
 * Usage:
 *   @PropertyScopeBody('leaseId')
 *   — guard reads req.body.leaseId, looks up lease → unit → property_id
 *
 * Supported body-field resolution modes:
 *   leaseId  → lease → unit → property_id
 *
 * H-02: used on POST /deposit-refunds so that the PM's property is verified
 * even though the lease ID is in the body (not a route param).
 */
export const PROPERTY_SCOPE_BODY_KEY = "property_scope_body";

export type PropertyScopeBodyField = "leaseId";

export const PropertyScopeBody = (bodyField: PropertyScopeBodyField) =>
  SetMetadata(PROPERTY_SCOPE_BODY_KEY, bodyField);
