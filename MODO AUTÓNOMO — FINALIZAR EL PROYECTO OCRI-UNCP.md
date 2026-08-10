# MODO AUTÓNOMO — FINALIZAR EL PROYECTO OCRI-UNCP

A partir de este momento quiero que dejes el modo de espera de instrucciones y pases a trabajar como **desarrollador senior responsable de llevar este proyecto hasta un estado funcional y coherente**.

Ya realizaste una auditoría completa del proyecto y ya conoces:

- La arquitectura.
- El backend.
- El frontend.
- La base de datos.
- Las entidades.
- Los módulos existentes.
- Los flujos actuales.
- Las funcionalidades implementadas.
- Las funcionalidades incompletas.
- Las inconsistencias.
- Las limitaciones.
- Los riesgos.
- Las dudas de negocio.

Por lo tanto, **no quiero que vuelvas a realizar una auditoría general desde cero**.

Tu objetivo ahora es utilizar todo ese conocimiento para avanzar progresivamente hasta completar el sistema.

---

# OBJETIVO PRINCIPAL

Quiero que lleves el proyecto desde su estado actual hasta un estado **funcional, coherente y listo para ser utilizado**, tanto en:

- Frontend.
- Backend.
- Integración frontend/backend.
- Base de datos cuando sea estrictamente necesario.
- Validaciones.
- Manejo de errores.
- Autenticación/autorización.
- Flujos de negocio.
- UI.
- Tests razonables.
- Configuración necesaria para ejecución.

No quiero que simplemente completes archivos faltantes.

Quiero que entiendas primero **qué necesita el sistema para estar realmente terminado** y luego lo implementes progresivamente.

---

# IMPORTANTE: NO INVENTAR EL NEGOCIO

Hay una diferencia entre:

### Decisiones técnicas

Puedes tomarlas tú cuando sean razonables y coherentes con el proyecto.

Ejemplos:

- Cómo estructurar un componente.
- Cómo reutilizar un service.
- Cómo organizar una función.
- Cómo manejar un estado de carga.
- Cómo reutilizar un DTO.
- Cómo implementar una validación técnica.

### Decisiones de negocio

No debes inventarlas.

Ejemplos:

- Qué significa exactamente un estado.
- Qué usuarios pueden aprobar algo.
- Qué información debe contener un oficio.
- Qué reglas debe cumplir un convenio.
- Qué datos debe contener un reporte.
- Qué personas participan en determinado flujo.
- Qué debe ocurrir después de determinada etapa.

Cuando llegues a una decisión de negocio que el código existente, la documentación o el contexto disponible NO permitan determinar razonablemente:

**DETENTE y pregúntame.**

No inventes una regla simplemente para poder continuar.

---

# AUTONOMÍA

Dentro de lo anterior, quiero que seas autónomo.

No quiero tener que decirte:

> "Ahora crea el DTO."

> "Ahora crea el endpoint."

> "Ahora crea el formulario."

> "Ahora conecta el frontend."

Si una funcionalidad requiere todas esas piezas, debes identificarlo tú y realizar el trabajo completo.

Por ejemplo:

```text
Funcionalidad
    ↓
Analizar negocio
    ↓
BD
    ↓
Backend
    ↓
API
    ↓
Frontend
    ↓
UI
    ↓
Validaciones
    ↓
Errores
    ↓
Integración
    ↓
Verificación
```

Debes pensar en el flujo completo.

---

# PLAN DE TRABAJO

Primero utiliza el resultado de tu auditoría para construir internamente una lista de trabajo.

Clasifica las tareas en:

## P0 — Bloqueantes

Problemas que impiden que el sistema sea correctamente utilizable.

## P1 — Funcionalidades principales faltantes

Funcionalidades necesarias para completar el producto.

## P2 — Funcionalidades secundarias

Funcionalidades importantes pero no bloqueantes.

## P3 — Calidad y deuda técnica

Tests, limpieza, refactors pequeños, mejoras de consistencia, etc.

No necesitas implementar todo inmediatamente.

Establece un orden lógico de ejecución.

---

# ORDEN DE PRIORIDAD

Como regla general utiliza este orden:

1. Comprender y cerrar los flujos principales existentes.
2. Corregir problemas que rompan funcionalidades existentes.
3. Completar funcionalidades fundamentales.
4. Completar frontend y backend de cada módulo.
5. Completar integraciones.
6. Completar funcionalidades secundarias.
7. Mejorar validaciones y manejo de errores.
8. Implementar autorización cuando las reglas de roles estén suficientemente claras.
9. Tests.
10. Limpieza y deuda técnica.
11. Preparación para producción.

Pero puedes cambiar este orden si encuentras una dependencia técnica que haga necesario otro camino.

Si cambias el orden, explica brevemente por qué.

---

# FUNCIONALIDADES PENDIENTES DETECTADAS

Durante tu auditoría identificaste, entre otras:

- Página de Instituciones.
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
- Configuración/deployment.

No significa que debas implementar ciegamente cada una.

Antes de implementar una funcionalidad, determina:

1. Si realmente pertenece al alcance del sistema.
2. Qué evidencia existe en el código.
3. Qué parte ya está preparada.
4. Qué falta.
5. Si requiere una decisión de negocio.

Si la evidencia demuestra claramente que forma parte del sistema, puedes avanzar.

Si no es posible determinarlo, pregúntame.

---

# NO MODIFICAR LA BASE DE DATOS SIN CONTROL

La base de datos es heredada de Laravel.

Por lo tanto:

### Puedes modificar código normalmente cuando no sea necesario cambiar el schema.

Pero si una funcionalidad requiere:

- Nueva tabla.
- Nueva columna.
- Nueva relación.
- Cambio de tipo.
- Eliminación de columna.
- Índice.
- Migración.

Debes:

1. Explicar qué cambio necesitas.
2. Explicar por qué.
3. Indicar qué impacto tendrá.
4. Esperar mi autorización antes de modificar el schema.

No ejecutes:

- `prisma migrate`
- `prisma db push`
- DROP
- operaciones destructivas

sin autorización explícita.

---

# NO ROMPER LO EXISTENTE

Antes de implementar una funcionalidad, revisa cómo interactúa con:

- Convenios.
- Instituciones.
- Hoja de ruta.
- Documentos.
- Autenticación.
- Usuarios.
- Estados.
- Dashboard.

No reemplaces una implementación existente simplemente porque prefieres otra arquitectura.

No hagas refactors masivos.

No introduzcas:

- Otra librería de estado.
- Otro ORM.
- Otro framework.
- Otra arquitectura.
- Otra librería UI.

salvo que exista una necesidad real y me expliques primero por qué.

---

# FORMA DE TRABAJO POR CADA TAREA

Para cada bloque de trabajo realiza internamente:

## 1. Comprensión

Determina exactamente qué se necesita.

## 2. Análisis

Busca todos los archivos afectados.

## 3. Dependencias

Determina qué otras partes dependen de ellos.

## 4. Plan

Define la implementación completa.

## 5. Implementación

Modifica solamente lo necesario.

## 6. Verificación

Comprueba:

- TypeScript.
- Imports.
- Tipos.
- Endpoints.
- DTOs.
- Frontend.
- Backend.
- Integración.
- Errores evidentes.

## 7. Resumen

Explica qué hiciste.

---

# NO ME PIDAS CONFIRMACIÓN PARA DECISIONES TÉCNICAS MENORES

Si encuentras una decisión técnica pequeña y existe una opción claramente coherente con el proyecto:

**decídela tú y continúa.**

Por ejemplo:

> "Necesito crear un helper para reutilizar esta lógica."

Créalo.

No necesitas preguntarme.

Pero si la decisión cambia el comportamiento de negocio:

**pregúntame.**

---

# DETENTE SOLO CUANDO SEA NECESARIO

Debes detenerte y preguntarme únicamente cuando:

### 1. Falte información crítica de negocio.

### 2. Existan dos comportamientos posibles con consecuencias diferentes.

### 3. Sea necesario modificar el schema de la BD.

### 4. Sea necesario realizar una operación destructiva.

### 5. Exista riesgo significativo de romper datos existentes.

### 6. La auditoría haya detectado una duda que impida continuar correctamente.

En cualquier otro caso:

**toma una decisión razonable y continúa.**

---

# NO TE LIMITES A LOS ARCHIVOS EXISTENTES

Si una funcionalidad claramente requiere nuevos archivos, puedes crearlos.

Si requiere nuevos componentes, créalos.

Si requiere nuevos endpoints, créalos.

Si requiere nuevos DTOs, créalos.

Si requiere tests, créalos.

Pero siempre manteniendo la arquitectura existente.

---

# FRONTEND

Cuando completes una funcionalidad:

- Debe existir la página correspondiente.
- Debe existir la UI necesaria.
- Debe existir loading state.
- Debe existir manejo de errores.
- Debe existir validación apropiada.
- Debe conectarse realmente con el backend.
- Debe respetar el diseño existente.
- Debe ser navegable desde el sistema.

No consideres una funcionalidad terminada porque "la página existe".

Debe funcionar de extremo a extremo.

---

# BACKEND

Una funcionalidad backend debe estar realmente integrada:

```text
Controller
   ↓
DTO
   ↓
Validation
   ↓
Service
   ↓
Prisma
   ↓
MariaDB
```

Cuando corresponda.

No crees endpoints que no tengan consumidor si forman parte de una funcionalidad que debe estar disponible para el usuario.

---

# DEFINICIÓN DE "TERMINADO"

Considera una funcionalidad terminada únicamente cuando:

- Está implementada.
- Está conectada.
- Puede utilizarse desde el frontend cuando corresponda.
- Backend y frontend coinciden.
- Las validaciones existen.
- Los errores principales están contemplados.
- No existen referencias rotas relacionadas.
- No deja código evidentemente incompleto.
- No rompe las funcionalidades existentes.
- Ha sido verificada.

---

# CORREGIR INCONSISTENCIAS

Ahora sí puedes corregir las inconsistencias detectadas durante la auditoría **cuando sean necesarias para completar o estabilizar el sistema**.

Por ejemplo:

- Rutas 404.
- Tooltip de opiniones pendientes.
- Inconsistencias frontend/backend.
- Tipos incorrectos.
- Metadata inconsistente.
- Componentes muertos relacionados con funcionalidades que estás completando.
- Problemas de integración.

Pero no conviertas cada tarea en un refactor general.

Corrige lo necesario para avanzar.

---

# AUTORIZACIÓN Y SEGURIDAD

La auditoría detectó que existe infraestructura de roles pero actualmente no hay autorización efectiva por roles.

No inventes los roles.

Primero determina si el código/documentación existente permite establecerlos.

Si no:

**pregúntame qué roles y permisos necesita el sistema.**

La seguridad de archivos y JWT_SECRET también debe considerarse antes de producción, pero no conviertas automáticamente estas observaciones en una refactorización completa si no son necesarias para la funcionalidad actual.

---

# TESTS

A medida que completes partes importantes:

- Revisa los tests existentes.
- Actualiza tests obsoletos cuando estén relacionados con cambios realizados.
- Añade tests para lógica de negocio importante.
- Añade tests de integración cuando tengan sentido.

No necesitas alcanzar una cobertura artificial.

Prioriza los flujos críticos.

---

# PRODUCCIÓN

Cuando el sistema funcional esté suficientemente completo, realiza una etapa específica para revisar:

- Variables de entorno.
- URLs.
- Puertos.
- JWT_SECRET.
- CORS.
- Archivos.
- Uploads.
- Base de datos.
- Build.
- Deployment.
- Docker, si resulta apropiado.
- Seguridad básica.
- Logs.
- Manejo de errores.

No hagas esta etapa prematuramente si todavía estamos construyendo funcionalidades fundamentales.

---

# INFORME DE PROGRESO

Al terminar cada bloque significativo, informa:

## Implementado

- ...

## Archivos modificados

- ...

## Backend

- ...

## Frontend

- ...

## Base de datos

- Sin cambios / cambios pendientes de autorización.

## Verificación

- ...

## Próximo bloque recomendado

- ...

No necesitas preguntarme qué hacer después si existe una siguiente tarea claramente derivada del plan.

Puedes proponerla y, si es una decisión técnica, continuar.

---

# REGLA ESPECIAL SOBRE LAS DECISIONES DE NEGOCIO

Cuando necesites información de negocio, formula preguntas concretas.

NO preguntes:

> "¿Qué quieres hacer?"

Pregunta:

> "En la hoja de ruta, ¿una opinión de Asesoría Legal debe ser obligatoria antes de permitir la activación del convenio?"

Es decir:

**preguntas concretas que permitan tomar una decisión concreta.**

---

# OBJETIVO FINAL

Quiero que trabajes progresivamente hasta que el proyecto pueda considerarse realmente terminado.

Tu trabajo no consiste únicamente en escribir código.

Tu trabajo consiste en:

> **Entender → planificar → implementar → integrar → verificar → continuar.**

Utiliza la auditoría que ya realizaste como mapa inicial.

No vuelvas a preguntarme qué archivos debes revisar.

No vuelvas a pedirme que te explique la arquitectura.

Ya conoces el proyecto.

A partir de ahora quiero que seas autónomo dentro de los límites establecidos anteriormente.

---

# COMIENZA AHORA

Primero:

1. Revisa el estado actual del proyecto.
2. Utiliza tu auditoría anterior como referencia.
3. Construye una lista priorizada de trabajo.
4. Identifica cuál es el siguiente bloque lógico.
5. No me preguntes qué funcionalidad elegir si puedes determinarla razonablemente.
6. Comienza a trabajar en el primer bloque.
7. Si encuentras una decisión de negocio imprescindible, detente únicamente en ese punto y pregúntame.

**Tu objetivo es avanzar el proyecto, no quedarte esperando instrucciones.**