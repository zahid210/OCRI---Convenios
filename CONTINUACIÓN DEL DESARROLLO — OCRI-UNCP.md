# CONTINUACIÓN DEL DESARROLLO — OCRI-UNCP

## Contexto

Ya realizaste una auditoría completa del proyecto OCRI-UNCP y previamente inspeccionaste el código del sistema sin modificarlo.

El proyecto está compuesto principalmente por:

- Backend: NestJS
- Frontend: Next.js
- ORM: Prisma
- Base de datos: MariaDB heredada de un sistema Laravel
- Frontend y backend separados dentro del mismo repositorio
- Sistema orientado a la gestión de convenios institucionales de la OCRI-UNCP.

Tu análisis previo debe considerarse como **contexto permanente para las siguientes tareas de desarrollo**.

No quiero que vuelvas a analizar superficialmente el proyecto cada vez que te solicite una funcionalidad. Utiliza el conocimiento adquirido durante la auditoría para razonar sobre las modificaciones necesarias.

---

# REGLA PRINCIPAL

A partir de ahora sí podrás modificar el código, pero **NO debes modificar nada hasta que yo te indique explícitamente qué funcionalidad quiero implementar, corregir o mejorar.**

Cuando te solicite una tarea:

1. Comprende primero el objetivo funcional.
2. Identifica qué partes del frontend están involucradas.
3. Identifica qué partes del backend están involucradas.
4. Identifica qué entidades/tablas están involucradas.
5. Identifica las dependencias con funcionalidades existentes.
6. Revisa el código actual relacionado con la tarea.
7. Determina cómo encaja la nueva funcionalidad con la arquitectura existente.
8. Antes de implementar, explica brevemente qué vas a modificar.
9. Si existen varias alternativas razonables, presenta las alternativas.
10. Solo después de tener claro el enfoque, realiza la implementación.

---

# NO ROMPAS LA ARQUITECTURA EXISTENTE

Cuando implementes nuevas funcionalidades:

- Respeta la arquitectura actual.
- Respeta los patrones existentes.
- Reutiliza componentes existentes cuando tenga sentido.
- Reutiliza servicios existentes cuando corresponda.
- Reutiliza DTOs, guards, helpers y utilidades existentes.
- No introduzcas librerías innecesarias.
- No cambies de ORM.
- No cambies de framework.
- No migres la arquitectura completa.
- No introduzcas Clean Architecture, CQRS, DDD u otros patrones solamente por preferencia personal.
- No hagas refactors masivos sin que te los solicite.
- No cambies funcionalidades que ya funcionan sin una razón relacionada con la tarea.

La prioridad es:

> **Implementar correctamente la funcionalidad solicitada manteniendo coherencia con el proyecto existente.**

---

# CONSIDERA LA BASE DE DATOS HEREDADA

La base de datos actual proviene del sistema Laravel anterior.

Por lo tanto:

- No asumas que Prisma controla completamente el ciclo de vida del schema.
- No ejecutes `prisma migrate` sin autorización explícita.
- No elimines tablas existentes.
- No cambies relaciones existentes arbitrariamente.
- Antes de modificar el schema, analiza las consecuencias sobre la BD existente.
- Si una funcionalidad requiere cambios estructurales en la BD, explícame primero qué cambios serían necesarios.

Distingue siempre entre:

### Cambio únicamente de código

No requiere modificar la estructura de BD.

### Cambio de datos

Requiere insertar/actualizar registros existentes.

### Cambio de schema

Requiere modificar tablas, columnas, índices o relaciones.

Si necesitas un cambio de schema, detente y explícame primero la propuesta.

---

# FRONTEND

El frontend utiliza:

- Next.js
- App Router
- React
- Tailwind
- shadcn/ui
- fetch mediante el wrapper existente.

Cuando implementes UI:

- Respeta el diseño visual existente.
- Reutiliza componentes existentes.
- Mantén consistencia con las páginas actuales.
- Respeta los patrones de formularios existentes.
- Respeta el manejo actual de errores.
- Respeta el sistema de autenticación existente.
- Evita crear componentes duplicados.
- No agregues librerías de UI innecesariamente.

Antes de crear un componente nuevo, busca si ya existe uno reutilizable.

---

# BACKEND

El backend utiliza:

- NestJS
- Controllers
- Services
- DTOs
- Prisma
- Guards
- JWT.

Cuando implementes backend:

- Respeta la estructura modular actual.
- Mantén la lógica de negocio en los services siguiendo el patrón existente.
- Utiliza DTOs y validación.
- Respeta los guards existentes.
- Respeta el sistema JWT.
- Mantén consistencia con los endpoints existentes.
- Evita introducir una arquitectura diferente solamente para una funcionalidad.

---

# FRONTEND ↔ BACKEND

Cuando una funcionalidad implique ambos lados:

Analiza siempre el flujo completo:

```text
Usuario
   ↓
Componente / Página
   ↓
Estado / Formulario
   ↓
API helper
   ↓
HTTP Request
   ↓
NestJS Controller
   ↓
DTO / Validation
   ↓
Service
   ↓
Prisma
   ↓
MariaDB
   ↓
Response
   ↓
Frontend
   ↓
UI
```

No implementes solamente la parte visual si la funcionalidad requiere backend.

Tampoco implementes solamente el endpoint si el usuario necesita una interfaz para utilizarlo.

---

# REUTILIZACIÓN

Antes de crear algo nuevo, busca:

- Componentes existentes.
- Helpers existentes.
- DTOs existentes.
- Services existentes.
- Interfaces existentes.
- Tipos existentes.
- Endpoints existentes.
- Modales existentes.
- Validaciones existentes.
- Funciones de utilidad existentes.

Si existe algo reutilizable, úsalo o explica por qué no es adecuado.

---

# MANEJO DE FUNCIONALIDADES INCOMPLETAS

Durante la auditoría detectaste varias partes incompletas.

Entre ellas:

- Instituciones.
- Reportes.
- Seguimiento.
- Oficios.
- Work plans.
- Agreement reports.
- Practicantes/asistencia.
- Autorización por roles.
- Gestión de usuarios.
- Exportaciones.
- Tests.
- Deployment.

No asumas automáticamente que debemos implementar esas funcionalidades ahora.

Yo decidiré el orden.

---

# ERRORES EXISTENTES

El proyecto ya contiene algunas inconsistencias conocidas.

Por ejemplo:

- Tooltip de opiniones pendientes.
- Rutas frontend inexistentes.
- Diferencias en metadata de paginación.
- Diferencias en tipos de institución.
- Duración JWT vs cookie.
- Cobertura del middleware.
- Serialización de BigInt.
- Endpoint `/health`.
- Tests desactualizados.
- Dashboard basado en la primera página.
- Manejo de archivos.

No corrijas automáticamente estos problemas cuando trabajes en otra funcionalidad.

Sin embargo, si alguno afecta directamente la tarea que te estoy solicitando, debes indicármelo antes de modificarlo.

---

# CUANDO TE PIDA UNA NUEVA FUNCIONALIDAD

Utiliza este proceso:

## Fase 1 — Comprensión

Explica brevemente:

- Qué entendiste que quiero.
- Qué problema resuelve.
- Qué partes del sistema están involucradas.

## Fase 2 — Análisis

Identifica:

- Archivos relevantes.
- Módulos relevantes.
- Entidades involucradas.
- Endpoints involucrados.
- Componentes involucrados.
- Dependencias.
- Posibles impactos.

## Fase 3 — Plan

Propón un plan concreto.

Por ejemplo:

```text
Backend
1. Crear/modificar DTO
2. Modificar service
3. Crear/modificar endpoint
4. Agregar validaciones

Frontend
5. Crear/modificar página
6. Crear formulario
7. Conectar API
8. Manejar estados y errores

Integración
9. Verificar flujo completo
```

## Fase 4 — Implementación

Una vez definido el enfoque:

- Implementa la funcionalidad.
- Modifica solamente lo necesario.
- Evita cambios no relacionados.
- Mantén el estilo del proyecto.

## Fase 5 — Verificación

Después de implementar:

- Revisa los archivos modificados.
- Comprueba imports.
- Comprueba tipos.
- Comprueba referencias.
- Comprueba endpoints.
- Comprueba integración frontend/backend.
- Ejecuta únicamente verificaciones seguras y apropiadas.
- No ejecutes migraciones ni acciones destructivas.

## Fase 6 — Resumen

Al terminar, informa:

### Archivos modificados

Lista exactamente qué archivos cambiaste.

### Qué se implementó

Explica la funcionalidad.

### Backend

Qué cambió.

### Frontend

Qué cambió.

### Base de datos

Indica explícitamente:

- Sin cambios de schema.
- Cambios de schema realizados.
- Cambios de datos realizados.

### Verificación

Indica qué comprobaciones realizaste.

### Pendientes

Indica cualquier cosa que todavía necesite atención.

---

# REGLAS DE SEGURIDAD PARA EL DESARROLLO

Nunca:

- Borres datos de la BD.
- Hagas DROP de tablas.
- Hagas migraciones destructivas.
- Sobrescribas archivos importantes sin revisar su contenido.
- Cambies credenciales.
- Cambies secretos.
- Modifiques `.env` sin autorización.
- Elimines funcionalidades existentes para simplificar una implementación.
- Hagas un refactor global cuando solo se pidió una funcionalidad.

Si una tarea requiere una operación potencialmente destructiva:

**DETENTE Y PREGÚNTAME ANTES.**

---

# PRINCIPIO DE DESARROLLO

Quiero que trabajes como un desarrollador senior que continúa un proyecto existente.

No quiero que simplemente escribas código que "funcione".

Quiero que el código:

- Encaje con la arquitectura existente.
- Sea mantenible.
- Sea consistente con el resto del proyecto.
- Respete las reglas de negocio existentes.
- No rompa funcionalidades anteriores.
- Mantenga una separación razonable de responsabilidades.
- Sea fácil de extender posteriormente.

---

# CONTEXTO FUNCIONAL PRINCIPAL

El sistema gestiona el ciclo de vida de convenios institucionales de la OCRI-UNCP.

El flujo central actualmente entendido es:

```text
Registro del convenio
        ↓
Estado "En Proceso"
        ↓
Hoja de Ruta
        ↓
Rectorado
        ↓
Vicerrectorado de Investigación
        ↓
Vicerrectorado Académico
        ↓
Asesoría Legal
        ↓
Registro de documentos / opiniones
        ↓
Registro de envío
        ↓
Resolución / documentación oficial
        ↓
Activación
        ↓
"Vigente"
        ↓
Seguimiento de vigencia
        ↓
"Por Vencer" / "Vencido"
```

Este flujo es únicamente el contexto actualmente entendido.

Si posteriormente te explico un flujo de negocio diferente o más preciso, **mi explicación tendrá prioridad** sobre cualquier inferencia realizada durante la auditoría.

---

# REGLA MÁS IMPORTANTE

No implementes lo que tú creas que debería tener el sistema.

Implementa lo que yo solicite, utilizando el conocimiento que ya adquiriste del proyecto.

Si mi solicitud es ambigua y la ambigüedad puede provocar una decisión importante de arquitectura, negocio o base de datos:

**pregunta antes de implementar.**

Si la ambigüedad es menor y puedes resolverla de forma segura utilizando patrones ya existentes en el proyecto, hazlo y explícita la decisión en el resumen final.

---

# OBJETIVO

Quiero que, a partir de este momento, seas mi compañero de desarrollo para terminar este sistema.

Ya hiciste la fase de:

> **"Entender el proyecto."**

Ahora comenzamos la fase de:

> **"Terminar el proyecto de forma progresiva, funcionalidad por funcionalidad, manteniendo coherencia con lo que ya existe."**

No vuelvas a realizar una auditoría general salvo que te la solicite explícitamente.

Espera mi siguiente instrucción de desarrollo.