Sí, continúa con el modo autónomo, pero toma las siguientes decisiones como definición del alcance actual:

### 1. Reportes

Sí quiero implementar el módulo de Reportes.

Inicialmente debe permitir consultar información útil sobre los convenios, como mínimo:

* Convenios por estado.
* Convenios por país.
* Convenios por tipo.
* Convenios por institución.
* Convenios próximos a vencer.
* Convenios vencidos.
* Cantidad total de convenios.
* Instituciones con mayor cantidad de convenios.

Quiero que el sistema permita **filtrar los reportes** y que los resultados puedan ser **exportados**.

Para la primera implementación, prioriza **Excel**. No implementes PDF todavía salvo que encuentres que la arquitectura existente ya tiene una base clara para generarlo.

Antes de implementar el módulo completo, analiza qué información real está disponible actualmente en la BD y diseña los reportes utilizando los datos existentes.

No inventes métricas que no puedan obtenerse de forma fiable.

---

### 2. Seguimiento

Sí quiero implementar el módulo de Seguimiento.

El objetivo principal debe ser poder visualizar el **estado de tramitación de los convenios**, especialmente la hoja de ruta.

Quiero que permita identificar:

* Convenios en proceso.
* Convenios activados.
* Convenios pendientes de completar su hoja de ruta.
* Áreas que todavía no han completado su participación.
* Documentos de entrada/salida faltantes.
* Envíos registrados.
* Convenios próximos a completar o activar.

La información debe aprovechar la estructura actual de `roadmap_items`, `roadmap_documents` y los datos de envío que ya existen.

No inventes un nuevo flujo de seguimiento si el actual modelo de convenios + hoja de ruta ya permite construirlo.

El objetivo es que la OCRI pueda entrar a "Seguimiento" y saber rápidamente **qué convenios están pendientes y en qué etapa se encuentra cada uno**.

---

### 3. Usuarios y roles

Sí quiero implementar gestión de usuarios y roles.

Pero aquí quiero que seas cuidadoso.

Actualmente el sistema tiene JWT y `RolesGuard`, pero no existen roles funcionales claramente definidos.

Propón primero una estructura inicial de roles basada en el funcionamiento de una oficina administrativa como OCRI.

Como punto de partida puedes considerar:

* `admin`: acceso completo.
* `editor`: puede gestionar convenios e instituciones, pero no administrar usuarios ni configuraciones sensibles.
* `viewer`: solamente consulta información.

Pero **NO implementes todavía la autorización definitiva** si detectas que estas reglas necesitan afectar procesos críticos.

Antes de aplicar restricciones a acciones sensibles como:

* Activar convenios.
* Eliminar convenios.
* Eliminar instituciones.
* Gestionar usuarios.

presenta primero cómo quedarían los permisos y utiliza ese modelo como propuesta.

Si el código actual permite implementarlo de forma segura sin cambios de schema, puedes continuar.

Si necesitas cambiar la estructura de usuarios/roles de la BD, detente y explícame el cambio antes de hacerlo.

---

### 4. Oficios / trámites / work_plans

Sí considero que estos módulos forman parte del proyecto, pero **NO quiero que los implementes todavía de forma inventada**.

La estructura existente indica que probablemente son funcionalidades futuras del sistema, pero todavía necesito definir correctamente sus reglas de negocio.

Por ahora:

* No los descartes.
* No los elimines.
* No los implementes parcialmente inventando comportamiento.
* Conserva los modelos existentes.
* Analiza qué funcionalidades parecen estar previstas.
* Déjalos identificados como módulos pendientes.

Cuando lleguemos a ellos, primero te proporcionaré las reglas de negocio necesarias.

---

# Orden de trabajo

Con estas decisiones, continúa autónomamente siguiendo este orden:

### Bloque 3

**Reportes**

### Bloque 4

**Seguimiento**

### Bloque 5

**Usuarios y roles**

Después de esos tres bloques, vuelve a realizar una evaluación del proyecto completo y dime:

* Qué funcionalidades principales ya están terminadas.
* Qué funcionalidades siguen pendientes.
* Qué problemas importantes quedan.
* Qué decisiones de negocio todavía necesito definir.
* Qué recomiendas implementar después.

No empieces todavía con Oficios, Work Plans ni otros módulos cuyo comportamiento de negocio no esté definido.

---

# Importante

Mantén el mismo criterio de trabajo:

* Decisiones técnicas → puedes tomarlas autónomamente.
* Decisiones de negocio → no las inventes.
* Cambios de schema → detente y consulta.
* Operaciones destructivas → detente y consulta.
* No hagas refactors generales innecesarios.
* Reutiliza la arquitectura existente.
* Completa cada funcionalidad de extremo a extremo: backend + API + frontend + integración + validación + verificación.

Puedes comenzar ahora con el **Bloque 3 — Reportes**.
