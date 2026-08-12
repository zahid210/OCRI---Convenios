# ETAPA 12 — AUDITORÍA Y ALINEACIÓN FRONTEND ↔ BACKEND

## OBJETIVO

Después de completar la Etapa 11, se detectó una inconsistencia importante:

> La página `/reports` del frontend parece utilizar endpoints y una firma de `downloadFile()` que no coinciden con el backend actualmente implementado.

Antes de corregirlo directamente, quiero realizar una **auditoría completa de integración entre frontend y backend** para detectar si existen más inconsistencias similares.

La prioridad es que:

```text
Frontend
   ↕
API / contratos
   ↕
Backend
   ↕
Prisma / BD
```

estén realmente alineados.

---

# REGLA PRINCIPAL

No quiero que inventes endpoints ni que adaptes el frontend basándote en lo que "debería existir".

Primero debes leer:

* frontend;
* controllers;
* services;
* DTOs;
* tipos TypeScript;
* llamadas API;
* respuestas reales;
* Prisma;
* rutas existentes.

Después determinarás qué está realmente implementado.

---

# FASE 1 — AUDITORÍA COMPLETA

Revisa todo el frontend buscando:

```text
fetch(
axios
api.get
api.post
api.put
api.patch
api.delete
downloadFile(
```

y cualquier wrapper utilizado para llamadas HTTP.

Identifica todas las llamadas realizadas desde:

```text
src/app/
src/components/
src/lib/
src/services/
src/hooks/
```

según la estructura real del proyecto.

Para cada llamada registra:

```text
Página/componente
Método HTTP
Endpoint
Parámetros
Body
Headers
Respuesta esperada
```

---

# FASE 2 — COMPARAR CONTRA BACKEND

Revisa todos los controllers actuales de NestJS:

```text
agreements
institutions
users
reports
seguimiento
notifications
auth
```

y cualquier otro módulo existente.

Para cada endpoint del frontend determina:

### A. Existe y coincide

```text
Frontend → Backend
✓
```

### B. Existe pero el contrato no coincide

Ejemplo:

```text
Frontend espera:
{ data: [...] }

Backend devuelve:
{ items: [...] }
```

### C. El endpoint no existe

```text
Frontend:
GET /reports/...

Backend:
NO existe
```

### D. El endpoint existe pero usa parámetros diferentes

### E. El endpoint existe pero requiere permisos diferentes

### F. El endpoint existe pero la respuesta ya cambió

---

# FASE 3 — AUDITAR REPORTES EN PROFUNDIDAD

Presta especial atención a `/reports`.

Lee completamente:

```text
src/app/(dashboard)/reports/page.tsx
```

y todos los servicios relacionados.

Después lee:

```text
src/modules/reports/
```

si existe.

Determina exactamente:

### Frontend espera

* resumen;
* filtros;
* estados;
* países;
* tipos;
* instituciones;
* próximos a vencer;
* vencidos;
* top instituciones;
* exportación Excel;
* cualquier otro endpoint.

### Backend realmente expone

Lista exactamente:

```text
GET /...
GET /...
POST /...
```

No asumas.

---

# FASE 4 — EXPORTACIÓN EXCEL

Analiza específicamente:

```text
downloadFile(...)
```

Determina:

1. qué firma tiene actualmente;
2. cómo la utiliza `/reports`;
3. qué endpoint espera;
4. qué endpoint existe realmente;
5. qué formato devuelve backend;
6. cómo se descarga actualmente el archivo.

No cambies todavía la implementación hasta comprender el contrato.

---

# FASE 5 — BUSCAR MÁS INCONSISTENCIAS

No quiero limitar esta auditoría a Reportes.

Busca problemas del mismo tipo en:

### Convenios

* listado;
* detalle;
* creación;
* edición;
* activación;
* documentos;
* roadmap;
* búsqueda.

### Instituciones

* listado;
* búsqueda;
* creación;
* edición;
* eliminación.

### Usuarios

* listado;
* creación;
* edición;
* cambio de rol;
* eliminación.

### Seguimiento

* resumen;
* filtros;
* progreso;
* documentos faltantes.

### Notificaciones

* contador;
* listado;
* estados;
* navegación.

### Auth

* login;
* logout;
* JWT;
* usuario actual;
* roles.

---

# FASE 6 — VERIFICAR CONTRATOS DE DATOS

No basta con comprobar que la URL existe.

Comprueba también:

```text
camelCase
snake_case
nombres de propiedades
tipos
null / undefined
arrays
objetos
paginación
meta
status
enums
fechas
```

Ejemplo:

```text
Frontend:
last_page

Backend:
lastPage
```

Esto ya ocurrió anteriormente con instituciones, por lo que quiero que busques activamente inconsistencias de este tipo.

---

# FASE 7 — DETECTAR ENDPOINTS MUERTOS

Identifica:

### Frontend que llama endpoints inexistentes

y:

### Backend que expone endpoints que ningún frontend utiliza.

No elimines nada.

Solo reporta.

Puede haber endpoints preparados para funcionalidades futuras.

---

# FASE 8 — DETECTAR FUNCIONALIDADES "A MEDIAS"

Busca páginas donde:

```text
UI existe
pero API no existe
```

o:

```text
API existe
pero UI no la utiliza
```

o:

```text
UI aparenta funcionar
pero usa datos hardcodeados/mock
```

o:

```text
UI muestra una estructura
pero backend devuelve otra
```

Esto es especialmente importante para detectar funcionalidades que quedaron de una versión anterior.

---

# FASE 9 — NO MODIFICAR TODAVÍA

Durante las fases 1–8:

**NO hagas modificaciones.**

No:

* cambies endpoints;
* cambies DTOs;
* cambies servicios;
* cambies controllers;
* cambies schema;
* cambies BD;
* elimines código;
* instales librerías;
* hagas refactors.

Primero quiero el diagnóstico.

---

# FASE 10 — INFORME

Entrega una tabla como esta:

| Prioridad | Área    | Frontend   | Backend    | Problema             | Acción recomendada |
| --------- | ------- | ---------- | ---------- | -------------------- | ------------------ |
| P0        | Reports | `/reports` | `/reports` | contrato inexistente | Alinear            |
| P1        | ...     | ...        | ...        | ...                  | ...                |

Clasifica:

### P0

Rompe una funcionalidad existente.

### P1

Funcionalidad parcialmente rota o inconsistente.

### P2

Inconsistencia que actualmente no rompe el flujo.

### P3

Código muerto / deuda técnica / futuro.

---

# FASE 11 — PROPUESTA DE SOLUCIÓN

Después del diagnóstico, para cada P0/P1 indica:

```text
Problema
↓
Causa
↓
Qué capa está desactualizada
↓
Solución propuesta
↓
Archivos que habría que modificar
```

Muy importante:

No asumas automáticamente que el frontend está equivocado.

Puede ser:

```text
Frontend correcto + backend desactualizado
```

o:

```text
Backend correcto + frontend desactualizado
```

o:

```text
Ambos pertenecen a versiones diferentes
```

Determínalo leyendo el código.

---

# FASE 12 — DECISIÓN ARQUITECTÓNICA

Para cada inconsistencia importante determina cuál de estas opciones es más coherente:

```text
A) Ajustar frontend al backend actual
B) Ajustar backend al frontend actual
C) Ajustar ambos manteniendo el contrato funcional existente
D) Eliminar/retirar una funcionalidad realmente obsoleta
```

No ejecutes todavía ninguna de estas opciones.

Solo recomienda.

---

# REGLAS QUE DEBES RESPETAR

## No inventar

No crear endpoints simplemente porque el frontend los espera.

## No eliminar

No eliminar endpoints existentes porque no encuentres uso inmediato.

## No cambiar schema

No Prisma migrate.

No Prisma db push.

No ALTER TABLE.

## No tocar datos

No UPDATE masivos.

No DELETE.

## No instalar librerías

No agregar dependencias.

## No refactor general

Solo auditoría.

---

# VERIFICACIÓN DE LA AUDITORÍA

Además del análisis estático, si es posible y seguro:

* verifica endpoints con el backend actualmente disponible;
* comprueba códigos HTTP;
* compara respuestas reales;
* verifica autenticación;
* verifica permisos por rol.

No realices operaciones destructivas.

Para endpoints GET puedes hacer pruebas reales.

Para POST/PATCH/DELETE no ejecutes operaciones sobre datos reales salvo que puedas utilizar un entorno/datos de prueba controlado y sea estrictamente necesario.

---

# CONTEXTO IMPORTANTE

El proyecto actualmente utiliza:

```text
NestJS
Next.js
Prisma
MariaDB
JWT
roles admin/editor/viewer
```

Y ya tiene implementados:

* Login/JWT
* Dashboard
* Convenios
* Instituciones
* Roadmap
* Documentos
* Opiniones derivadas
* Reportes
* Seguimiento
* Usuarios/Roles
* Notificaciones
* Buscador del header
* Confirmaciones y Toasts

No vuelvas a implementar estas funcionalidades.

La finalidad de esta etapa es comprobar que todas las piezas realmente están conectadas entre sí.

---

# CRITERIO DE ÉXITO

Al finalizar quiero tener un mapa real de:

```text
┌──────────────┐
│   FRONTEND   │
└──────┬───────┘
       │
       │ HTTP
       ↓
┌──────────────┐
│   BACKEND    │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│    PRISMA    │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│    MARIADB   │
└──────────────┘
```

y saber exactamente:

1. qué funciona;
2. qué está roto;
3. qué está desactualizado;
4. qué está duplicado;
5. qué está preparado pero no utilizado;
6. qué necesita alineación;
7. qué debería dejarse intacto.

## COMIENZA

Realiza primero la auditoría completa.

**NO MODIFIQUES NADA EN ESTA ETAPA.**

Al finalizar entrega únicamente el informe de auditoría y la propuesta de solución priorizada.

Después detente y espera mi autorización antes de implementar cualquier corrección.
