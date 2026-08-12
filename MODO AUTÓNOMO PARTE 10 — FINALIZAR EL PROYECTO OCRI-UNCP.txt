# ETAPA 13 — CORRECCIÓN DE AUTORIZACIÓN EN UI DE CONVENIOS

## OBJETIVO

La auditoría de la Etapa 12 confirmó que el backend es actualmente la fuente de verdad para los permisos y que la matriz de roles funciona correctamente.

Sin embargo, se detectó una inconsistencia en el frontend:

```text
agreements/[id]/page.tsx
agreements/[id]/edit/page.tsx
```

Estas páginas muestran determinadas acciones a usuarios que, según su rol, no deberían poder ejecutarlas.

Quiero corregir **únicamente esta inconsistencia de UI**, utilizando el sistema de roles que ya existe.

---

# MATRIZ DE PERMISOS ACTUAL

Mantén exactamente la matriz existente:

| Acción                                      | admin | editor | viewer |
| ------------------------------------------- | ----: | -----: | -----: |
| Ver convenios                               |     ✅ |      ✅ |      ✅ |
| Ver instituciones                           |     ✅ |      ✅ |      ✅ |
| Ver reportes                                |     ✅ |      ✅ |      ✅ |
| Ver seguimiento                             |     ✅ |      ✅ |      ✅ |
| Crear/editar convenios                      |     ✅ |      ✅ |      ❌ |
| Crear/editar instituciones                  |     ✅ |      ✅ |      ❌ |
| Hoja de ruta: documentos, envíos, opiniones |     ✅ |      ✅ |      ❌ |
| Activar convenios                           |     ✅ |      ✅ |      ❌ |
| Eliminar convenios                          |     ✅ |      ❌ |      ❌ |
| Eliminar instituciones                      |     ✅ |      ❌ |      ❌ |
| Gestionar usuarios/roles                    |     ✅ |      ❌ |      ❌ |
| Exportar reportes Excel                     |     ✅ |      ✅ |      ✅ |

El backend ya aplica esta autorización.

**No modifiques esta matriz.**

---

# FASE 1 — REVISAR ANTES DE MODIFICAR

Lee completamente:

```text
src/app/(dashboard)/agreements/[id]/page.tsx
src/app/(dashboard)/agreements/[id]/edit/page.tsx
src/components/user-provider.tsx
src/lib/auth.ts
```

y revisa cómo se utiliza actualmente:

```text
useUser()
canManage(user)
isAdmin(user)
```

Busca también cómo se implementó la misma lógica en:

```text
institutions/page.tsx
users/page.tsx
agreements/page.tsx
```

Quiero que reutilices el patrón existente.

---

# FASE 2 — APLICAR GATING EN LA UI

## agreements/[id]/page.tsx

Revisa todas las acciones que modifican información.

Según la auditoría, deben estar protegidas visualmente las acciones relacionadas con:

* subir documentos de hoja de ruta;
* eliminar documentos;
* guardar situación;
* activar convenio;
* registrar envío;
* cualquier otra acción de modificación que encuentres en esta página.

La regla general es:

```text
admin → puede modificar
editor → puede modificar
viewer → solo lectura
```

Por lo tanto:

```text
canManage(user) === true
```

debe controlar la aparición de controles de modificación.

---

# FASE 3 — NO OCULTAR INFORMACIÓN DE SOLO LECTURA

Un usuario `viewer` debe seguir pudiendo consultar:

* datos del convenio;
* institución;
* fechas;
* estado;
* situación;
* hoja de ruta;
* documentos existentes;
* opiniones;
* progreso;
* información del convenio.

No conviertas la página en una página vacía para `viewer`.

Simplemente elimina/oculta las acciones que requieren modificación.

---

# FASE 4 — agreements/[id]/edit/page.tsx

Esta página es de edición, por lo que debes verificar especialmente:

```text
editor → puede editar
admin → puede editar
viewer → no puede editar
```

Además:

```text
Eliminar convenio → únicamente admin
```

El botón de eliminación debe utilizar:

```text
isAdmin(user)
```

o el helper equivalente existente.

No basta con ocultarlo por CSS.

No renderices el control para roles que no tienen permiso.

---

# FASE 5 — SEGURIDAD

IMPORTANTE:

El frontend **NO sustituye la autorización del backend**.

El backend seguirá siendo la fuente de verdad.

El objetivo de esta etapa es evitar que la UI muestre acciones que el usuario no puede ejecutar.

Por lo tanto:

```text
Frontend
→ oculta acciones no permitidas

Backend
→ continúa rechazando cualquier petición no autorizada
```

No elimines ni modifiques:

```text
@Roles(...)
RolesGuard
JwtAuthGuard
```

ni ningún mecanismo de autorización existente.

---

# FASE 6 — NO DUPLICAR LÓGICA

No escribas:

```text
user.role === 'admin' || user.role === 'editor'
```

repetidamente si el proyecto ya dispone de:

```text
canManage(user)
isAdmin(user)
```

Utiliza los helpers existentes.

Si descubres que falta un helper absolutamente necesario, analiza primero si puede reutilizarse uno existente.

No crees una nueva arquitectura de permisos.

---

# FASE 7 — REVISIÓN COMPLETA DE LA PÁGINA

Aunque la auditoría ya identificó las acciones principales, revisa ambas páginas completas.

Busca botones o controles como:

```text
Editar
Guardar
Eliminar
Activar
Subir
Adjuntar
Enviar
Cambiar
Actualizar
Confirmar
```

y determina si cada uno corresponde a:

```text
solo lectura
admin + editor
solo admin
```

No asumas que solamente los elementos mencionados en el informe son los únicos que necesitan revisión.

---

# FASE 8 — RESPETAR LA ETAPA 10

No modificar la lógica relacionada con:

```text
Convenio Firmado / Actualizado
opiniones validadas
roadmap
DOC. ENTRADA
DOC. SALIDA
progreso
docs faltantes
notificaciones
```

La Etapa 10 ya estableció que:

```text
Convenio Firmado / Actualizado
        ↓
todas las opiniones consideradas validadas
```

Esa lógica debe permanecer exactamente igual.

---

# FASE 9 — NO TOCAR LO PENDIENTE

No implementar en esta etapa:

* cambio dinámico del rol dentro del JWT;
* migración JWT;
* proxy;
* nuevos módulos;
* Oficios;
* Work Plans;
* normalización de instituciones;
* cambios de schema;
* cambios de BD;
* reportes adicionales;
* nuevos permisos.

Los P2/P3 de la auditoría quedan documentados para una etapa futura.

---

# FASE 10 — VERIFICACIÓN POR ROL

Debes comprobar al menos:

## ADMIN

Debe poder:

```text
ver
editar
subir documentos
eliminar documentos
activar
registrar envío
eliminar convenio
```

según corresponda a la página.

---

## EDITOR

Debe poder:

```text
ver
editar
subir documentos
eliminar documentos
activar
registrar envío
```

pero:

```text
NO eliminar convenio
```

---

## VIEWER

Debe poder:

```text
ver
consultar
```

pero NO debe visualizar controles de:

```text
editar
guardar
subir
eliminar
activar
registrar envío
```

---

# FASE 11 — VERIFICACIÓN BACKEND

No modifiques el backend.

Comprueba que continúa rechazando correctamente acciones no autorizadas.

Especialmente:

```text
viewer → operaciones de escritura → 403
editor → eliminar convenio → 403
admin → operaciones permitidas → éxito
```

Si necesitas comprobarlo, utiliza únicamente pruebas controladas y no destructivas cuando sea posible.

---

# FASE 12 — BUILD

Ejecuta:

### Frontend

```text
npx tsc --noEmit
npx eslint
npx next build
```

### Backend

No debería requerir cambios.

Pero comprueba que:

```text
npx tsc --noEmit
npx eslint
npx nest build
```

continúan pasando.

---

# FASE 13 — REVISIÓN FINAL

Después de modificar:

Busca nuevamente en ambas páginas cualquier control que pueda permitir modificación.

Comprueba que no haya acciones que se estén ocultando únicamente mediante CSS.

El control debe dejar de renderizarse cuando el usuario no tenga permiso.

---

# REGLA FUNDAMENTAL

Esta etapa debe ser pequeña y quirúrgica.

No quiero refactors.

No quiero rediseños.

No quiero cambiar la arquitectura.

No quiero cambiar permisos.

No quiero cambiar backend.

No quiero cambiar BD.

Solo:

```text
AUDITORÍA ETAPA 12
        ↓
PERMISOS YA DEFINIDOS
        ↓
UI NO LOS RESPETA
        ↓
CORREGIR UI
```

---

# INFORME FINAL

Al terminar informa:

1. archivos modificados;
2. controles protegidos;
3. qué puede ver/hacer `admin`;
4. qué puede ver/hacer `editor`;
5. qué puede ver/hacer `viewer`;
6. confirmación de que el backend no fue modificado;
7. resultado de tsc;
8. resultado de eslint;
9. resultado de next build;
10. resultado de nest build;
11. cualquier inconsistencia adicional encontrada.

## COMIENZA

Implementa únicamente esta corrección P1 identificada en la auditoría.

Al finalizar, entrega el informe y detente.
