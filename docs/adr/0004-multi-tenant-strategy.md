# ADR 0004 – Multi-Tenant Strategy

## Status
Accepted

## Context
La plataforma será SaaS multi-tenant.

## Decision
Resolver tenant por header X-Tenant-Slug.

## Consequences
- Aislamiento lógico
- Simplicidad de implementación
- Fácil integración con frontend
