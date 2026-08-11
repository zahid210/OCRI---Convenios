# ETAPA 9 — IMPLEMENTACIÓN CONTROLADA DE MIGRACIÓN DE SEEDERS LARAVEL

La auditoría de los seeders históricos ya terminó.

He revisado tu informe y autorizo pasar a la implementación, pero quiero que la migración se realice de forma **controlada, idempotente, verificable y conservadora con los datos históricos**.

Los seeders originales son:

```text
Convenios2021Seeder.php
Convenios2022Seeder.php
Convenios2023Seeder.php
Convenios2024Seeder.php
Convenios2025Seeder.php
DatabaseSeeder.php
```

La auditoría determinó:

```text
447 convenios históricos
2021 → 86
2022 → 69
2023 → 132
2024 → 58
2025 → 102
```

Actualmente la BD de negocio está vacía:

```text
agreements = 0
institutions = 0
documents = 0
roadmap_items = 0
```

`agreement_types` ya está poblada.

No hay PDFs históricos disponibles en el workspace, por lo tanto:

```text
documentos históricos a importar = 0
```

---

# ⚠️ REGLAS ABSOLUTAS

La información histórica debe preservarse.

NO quiero:

* inventar datos,
* eliminar datos históricos,
* cambiar nombres arbitrariamente,
* crear documentos falsos,
* crear PDFs ficticios,
* inventar fechas,
* inventar instituciones,
* inventar relaciones,
* modificar los seeders originales.

La migración debe adaptar los datos al modelo actual únicamente cuando exista una correspondencia clara.

---

# 1. NO UTILIZAR PRISMA SEED COMO MECANISMO AUTOMÁTICO

No conviertas estos datos históricos en un seed que se ejecute automáticamente cada vez que se ejecute:

```text
npx prisma db seed
```

Estos datos son históricos y representan una migración.

Quiero una migración/importación explícita y controlada.

Puede ser:

```text
script de importación one-time
```

o una estrategia equivalente que consideres técnicamente más segura.

Explícame primero qué mecanismo vas a utilizar.

---

# 2. CONSERVAR LOS SEEDERS ORIGINALES

Los archivos Laravel originales son la fuente histórica.

NO los modifiques.

NO los reformatees.

NO los "limpies".

NO los sobrescribas.

Si necesitas transformar información, hazlo en el nuevo proceso de migración.

---

# 3. PRIMER PASO OBLIGATORIO: DRY-RUN

Antes de realizar cualquier INSERT real quiero que exista un modo:

```text
DRY RUN
```

que lea los seeders y produzca un informe de lo que haría.

El dry-run debe mostrar como mínimo:

```text
Convenios encontrados: 447

Instituciones:
- nuevas:
- existentes:
- duplicados detectados:
- ambiguas:

Convenios:
- nuevos:
- ya existentes:
- conflictos:

Documentos:
- encontrados:
- importables:
- ausentes:

Roadmaps:
- creados:
- omitidos:

Errores:
- ...

Advertencias:
- ...
```

El dry-run NO debe modificar absolutamente nada.

---

# 4. MAPEO DE CONVENIOS

La auditoría detectó una diferencia semántica importante:

### Laravel

```text
title = código
name = nombre largo
```

Ejemplo conceptual:

```text
title = "001-2021"
name = "Nombre largo del convenio"
```

### Sistema actual

```text
title = nombre del convenio
resolution_number = código
```

Por lo tanto, el mapeo debe ser:

```text
Laravel.title
    ↓
Agreement.resolution_number

Laravel.name
    ↓
Agreement.title
```

NO inviertas estos campos.

Antes de implementar confirma que esta correspondencia coincide con el código actual de NestJS/Prisma.

---

# 5. ESTADO DEL CONVENIO

Los seeders Laravel tienen:

```text
status = "Vigente"
```

para todos los registros.

NO importes ciegamente ese valor.

El sistema actual utiliza:

```text
PENDING
ACTIVE
EXPIRED
```

Quiero que determines primero cómo se calcula actualmente el estado en el backend.

La regla propuesta es:

```text
si todavía no corresponde activar:
    PENDING

si está dentro de su periodo de vigencia:
    ACTIVE

si end_date ya pasó:
    EXPIRED
```

Pero:

**NO implementes esta regla literalmente si contradice la lógica actual del proyecto.**

Inspecciona primero el código actual y utiliza la misma semántica que utiliza la aplicación.

Especialmente revisa:

* activación de convenios,
* cálculo de vencimiento,
* dashboard,
* reportes,
* notificaciones.

Quiero que exista una única interpretación coherente.

---

# 6. FECHAS HISTÓRICAS

Conserva las fechas originales de Laravel.

No las modifiques para "hacer cuadrar" el estado.

Si un convenio de 2021 tiene una fecha de finalización histórica y por ello debe quedar `EXPIRED`, eso es correcto.

No cambies fechas para que aparezca como vigente.

---

# 7. TIPOS DE INSTITUCIÓN

La auditoría encontró que Laravel utiliza aproximadamente:

```text
Sector Público
Empresa Nacional
Educación
Salud
Comunidades
Universidad Internacional
Otros
...
```

mientras que la UI actual contempla:

```text
Universidad Nacional
Universidad Privada
Entidad Gubernamental
Empresa Privada
Organización Internacional
```

Por ahora:

## NO hagas una traducción arbitraria.

Quiero preservar el dato histórico original.

Como la columna actual es texto libre, importa el valor original cuando exista una correspondencia directa de campo.

No conviertas automáticamente:

```text
Educación → Universidad Privada
Salud → Entidad Gubernamental
Otros → Organización Internacional
```

etc.

Eso sería inventar semántica.

Si consideras necesario normalizar posteriormente estos valores, será una tarea independiente.

---

# 8. INSTITUCIONES DUPLICADAS

Este punto requiere especial cuidado.

La auditoría encontró:

* instituciones repetidas,
* diferencias de acentos,
* posibles diferencias ortográficas.

NO hagas simplemente:

```text
name.toLowerCase()
```

y consideres que todo lo parecido es la misma institución.

Tampoco elimines instituciones históricas.

Quiero que implementes una estrategia conservadora.

Clasifica las coincidencias como:

### Coincidencia exacta

Mismo nombre normalizado de forma segura.

### Coincidencia probable

Diferencias de acentos, espacios o diferencias menores claramente equivalentes.

### Ambigua

No podemos determinar con seguridad que sean la misma institución.

Las coincidencias ambiguas NO deben fusionarse automáticamente.

Deben aparecer en el reporte de migración para revisión.

---

# 9. IDENTIFICACIÓN DE CONVENIOS EXISTENTES

Los seeders no utilizan IDs hardcodeados.

La auditoría indica que la identificación puede realizarse utilizando:

* `resolution_number`
* `name`

Quiero que determines el mejor identificador natural según el modelo actual.

Prioridad:

```text
identificador único real
        ↓
resolution_number
        ↓
combinación segura de campos
        ↓
otros criterios
```

NO dependas exclusivamente del ID de la BD.

---

# 10. IDEMPOTENCIA

La migración debe ser idempotente.

Esto significa:

```text
Primera ejecución:
447 convenios importados

Segunda ejecución:
0 duplicados
0 duplicaciones

Tercera ejecución:
0 duplicados
```

Si una institución o convenio ya existe, debe detectarse correctamente.

NO quiero simplemente ignorar todos los errores de unique constraint.

La detección debe hacerse antes de insertar.

---

# 11. DOCUMENTOS

Los seeders Laravel intentan asociar PDFs si existen en:

```text
storage/convenios/{n}.pdf
```

La auditoría determinó:

```text
PDFs disponibles = 0
```

Por lo tanto:

## NO crear documentos falsos.

No crear:

```text
document.pdf
placeholder.pdf
```

ni registros ficticios de documentos.

El convenio debe importarse sin documentos históricos.

El resultado debe indicar:

```text
documentos encontrados = 0
documentos importados = 0
```

---

# 12. ROADMAP

Los seeders históricos NO contienen `roadmap_items`.

La aplicación actual crea automáticamente las 4 áreas por defecto.

Antes de implementar, verifica exactamente cómo funciona actualmente esa creación automática.

Si al crear/importar un convenio el sistema genera automáticamente su roadmap, reutiliza esa lógica existente en lugar de duplicarla.

NO crees manualmente una segunda estructura de roadmap si el service actual ya la crea.

Objetivo:

```text
Convenio importado
        ↓
Roadmap generado según lógica actual
        ↓
4 áreas por defecto
```

pero solo si eso coincide realmente con el comportamiento actual del backend.

---

# 13. REUTILIZAR LÓGICA EXISTENTE

No quiero duplicar innecesariamente reglas de negocio.

Antes de implementar inspecciona:

* AgreementsService.
* InstitutionsService.
* DTOs.
* PrismaService.
* creación de convenios.
* creación automática de roadmap.
* validaciones.
* normalización.
* enums.
* relaciones.

Si existe una función reutilizable y es apropiada para migración, considera reutilizarla.

Pero:

NO fuerces el flujo normal de la API si eso puede provocar efectos secundarios no deseados.

La migración debe ser segura para datos históricos.

---

# 14. TRANSACCIONES

Determina dónde es conveniente utilizar transacciones.

Idealmente, la creación de cada conjunto relacionado debería evitar estados parciales.

Por ejemplo:

```text
Institución
    ↓
Convenio
    ↓
Roadmap
```

Si falla una parte crítica, debemos poder detectar exactamente qué ocurrió.

No uses una transacción gigantesca para 447 registros si eso puede generar problemas innecesarios.

Evalúa una estrategia por lote/año/convenio.

Explica tu decisión.

---

# 15. LOGGING

La migración debe producir logs útiles.

Por cada convenio al menos debe ser posible determinar:

```text
año
código
institución
acción
resultado
```

Ejemplos:

```text
[2021] 001-2021 → CREATED
[2021] 002-2021 → SKIPPED_ALREADY_EXISTS
[2022] 010-2022 → CREATED
```

Para problemas:

```text
[2023] 025-2023 → ERROR
```

con la razón.

---

# 16. REPORTE FINAL

Después de ejecutar la migración debe existir un resumen como:

```text
==============================
MIGRACIÓN FINALIZADA
==============================

Seeders:
2021 → 86
2022 → 69
2023 → 132
2024 → 58
2025 → 102

Total esperado: 447
Total procesado: 447

Instituciones:
Nuevas:
Existentes:
Ambiguas:

Convenios:
Creados:
Ya existentes:
Errores:

Documentos:
Disponibles:
Importados:
Ausentes:

Roadmaps:
Generados:

Errores:
0

Advertencias:
...
```

---

# 17. VALIDACIÓN POST-MIGRACIÓN

Después de la migración, realiza SOLO validaciones de lectura.

Comprueba:

```text
SELECT/count agreements
SELECT/count institutions
```

y las relaciones principales.

Debe comprobarse como mínimo:

```text
447 convenios esperados
```

salvo que existieran previamente registros que deban detectarse como existentes.

Comprueba también:

* convenios sin institución,
* convenios sin tipo,
* convenios con fechas inválidas,
* convenios duplicados,
* instituciones duplicadas,
* relaciones rotas,
* roadmap faltante,
* estados inválidos.

---

# 18. VALIDAR AÑOS

Quiero una comprobación explícita:

```text
2021 → 86
2022 → 69
2023 → 132
2024 → 58
2025 → 102
```

Si los conteos finales no coinciden con lo esperado, no ocultes el problema.

Explica exactamente:

```text
esperados
encontrados
creados
omitidos
duplicados
errores
```

---

# 19. NO CAMBIAR EL SCHEMA

No hagas:

```text
prisma migrate
prisma db push
ALTER TABLE
```

La migración de datos debe funcionar con el schema actual.

Si descubres que el schema actual hace imposible importar correctamente algún dato:

**DETENTE y repórtalo.**

No modifiques el schema para solucionarlo.

---

# 20. NO CORREGIR OTRAS COSAS

Durante esta etapa NO aproveches para:

* limpiar lint,
* cambiar JWT,
* refactorizar servicios,
* cambiar UI,
* modificar roles,
* cambiar estados globales,
* modificar reportes,
* cambiar notificaciones,
* arreglar otros bugs.

La tarea es exclusivamente:

> migrar los datos históricos de Laravel al sistema actual.

---

# 21. ORDEN DE IMPLEMENTACIÓN

Trabaja en este orden:

```text
FASE 1
Inspección final del código actual

↓

FASE 2
Diseño del importador

↓

FASE 3
Implementar DRY-RUN

↓

FASE 4
Ejecutar DRY-RUN

↓

FASE 5
Analizar el resultado

↓

FASE 6
Si no existen bloqueadores:
ejecutar importación real

↓

FASE 7
Validación completa

↓

FASE 8
Informe final
```

---

# 22. REGLA ESPECIAL SOBRE BLOQUEADORES

Si durante el dry-run encuentras algo como:

```text
institución ambigua
convenio ambiguo
foreign key inexistente
campo obligatorio sin equivalente
estado imposible de determinar
duplicado no resoluble
```

NO inventes una solución.

Clasifícalo:

```text
BLOCKER
WARNING
INFO
```

y continúa únicamente con los registros que sean seguros si eso no compromete la integridad.

Si el problema afecta estructuralmente a todos los registros:

**DETENTE antes de la importación real.**

---

# 23. ANTES DE LA ESCRITURA REAL

Antes de ejecutar INSERT/UPDATE reales, debes mostrar en tu informe:

```text
¿Qué se va a insertar?
¿Qué se va a omitir?
¿Qué se considera existente?
¿Qué instituciones serán reutilizadas?
¿Qué instituciones son ambiguas?
¿Qué convenios tienen problemas?
¿Qué documentos serán importados?
¿Qué documentos faltan?
¿Qué estados serán asignados?
¿Cómo se calcularon?
```

Solo después de verificar el dry-run podrás realizar la escritura real.

---

# 24. CRITERIO DE ÉXITO

Consideraré correcta la migración si:

```text
447 registros históricos
        ↓
correctamente interpretados
        ↓
correctamente asociados a instituciones
        ↓
sin duplicados
        ↓
sin datos inventados
        ↓
sin documentos ficticios
        ↓
con estados coherentes
        ↓
con roadmap según la lógica actual
        ↓
con relaciones válidas
        ↓
y ejecución repetible sin duplicar
```

---

# 25. IMPORTANTE SOBRE EL ESTADO

Antes de escribir la lógica definitiva para `PENDING / ACTIVE / EXPIRED`, inspecciona el comportamiento actual de:

* AgreementsService.
* Activación.
* Dashboard.
* Reports.
* Notifications.

Quiero que la migración respete la semántica REAL de la aplicación actual.

No implementes una regla paralela.

---

# 26. IMPORTANTE SOBRE EL TÍTULO

La correspondencia acordada es:

```text
Laravel.title
    ↓
resolution_number

Laravel.name
    ↓
title
```

Conserva ambos valores.

No pierdas el código histórico.

---

# 27. IMPORTANTE SOBRE LOS DATOS HISTÓRICOS

No intentes "mejorar" los datos durante esta migración.

Esta migración debe responder:

> "¿Cómo trasladamos fielmente los datos existentes de Laravel al modelo actual?"

No:

> "¿Cómo deberíamos haber guardado estos datos?"

Las normalizaciones posteriores serán tareas separadas.

---

# COMIENZA

Primero inspecciona nuevamente el código actual necesario para implementar esta migración.

Después implementa el mecanismo de DRY-RUN.

Ejecuta el DRY-RUN.

Analiza sus resultados.

Si todo es seguro y no existen BLOCKERS, realiza la importación real.

Finalmente ejecuta las validaciones y entrega un informe completo.

Si aparece cualquier BLOCKER que requiera una decisión de negocio o una modificación del schema:

**NO continúes con la escritura real.**

Detente y explícame exactamente qué decisión necesito tomar.
