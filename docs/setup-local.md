# Setup Local

## Requisitos

- Node 22+
- PostgreSQL
- pnpm o npm

---

## Instalación

npm install

---

## Variables de entorno

Crear archivo .env

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/turnero"

---

## Migraciones

npx prisma migrate dev --name init_core

---

## Generar Prisma Client

npx prisma generate

---

## Seed

npx prisma db seed

---

## Correr backend

nx serve api

Aplicación disponible en:

http://localhost:3000/api
