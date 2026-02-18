# Architecture

## Monorepo

El proyecto utiliza Nx como workspace manager.

apps/
- api → Backend NestJS
- web → Frontend Next.js
- worker → Procesos asincrónicos

libs/
- Reservado para módulos compartidos

---

## Backend

Framework: NestJS  
ORM: Prisma  
Base de datos: PostgreSQL  

Arquitectura modular:

- TenantsModule
- PrismaModule
- (futuro) UsersModule
- (futuro) LocationsModule
- (futuro) AppointmentsModule

---

## Multi-Tenancy Strategy

Resolución por header:

X-Tenant-Slug

Cada request debe incluir:

X-Tenant-Slug: <slug>

El backend:

1. Resuelve el tenant por slug
2. Lo adjunta al contexto de request
3. Todas las queries deben filtrar por tenantId

---

## Seguridad

- No se permite acceso sin tenant válido
- Todas las entidades futuras deben incluir tenantId
- Se planea implementar guard global para validación de tenant
