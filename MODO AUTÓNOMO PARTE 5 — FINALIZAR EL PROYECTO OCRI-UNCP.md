# ETAPA — AUDITORÍA Y MIGRACIÓN DE SEEDERS HISTÓRICOS DE LARAVEL

Quiero realizar una tarea delicada relacionada con los datos históricos del antiguo sistema Laravel.

Tengo los siguientes seeders originales:

```text
Convenios2021Seeder.php
Convenios2022Seeder.php
Convenios2023Seeder.php
Convenios2024Seeder.php
Convenios2025Seeder.php
DatabaseSeeder.php
```

Estos seeders pertenecen al sistema anterior desarrollado en PHP Laravel y fueron utilizados para cargar datos históricos de convenios.

Actualmente el proyecto funciona con:

* NestJS
* Next.js
* Prisma
* MariaDB

La base de datos actual conserva información proveniente del sistema anterior.

---

# ⚠️ REGLA PRINCIPAL

## NO EJECUTES NINGÚN SEEDER NI INSERCIÓN DE DATOS TODAVÍA.

Primero quiero que leas, inspecciones y analices COMPLETAMENTE todos los seeders.

No quiero que implementes nada hasta terminar la auditoría.

Esta primera fase es exclusivamente:

```text
leer
↓
entender
↓
analizar
↓
comparar
↓
determinar viabilidad
↓
informar
```

Después de entregarme el informe, debes detenerte y esperar mi autorización explícita para implementar.

---

# 1. ARCHIVOS QUE DEBES ANALIZAR

Lee COMPLETAMENTE:

```text
Convenios2021Seeder.php
Convenios2022Seeder.php
Convenios2023Seeder.php
Convenios2024Seeder.php
Convenios2025Seeder.php
DatabaseSeeder.php
```

No leas solamente las primeras líneas ni busques únicamente los `insert`.

Quiero que entiendas todo el contenido y la lógica de cada archivo.

---

# 2. ANALIZAR DATABASESEEDER.PHP

Empieza por:

```text
DatabaseSeeder.php
```

Determina:

* Qué seeders ejecuta.
* En qué orden.
* Qué otros seeders existen y si son relevantes.
* Si existen condiciones.
* Si existen dependencias.
* Si existen seeders relacionados con usuarios, instituciones, convenios u otras entidades.
* Si alguno de los seeders históricos depende de otro.

Determina exactamente cuál sería el orden original de ejecución.

No ejecutes nada.

---

# 3. ANALIZAR CADA SEEDER ANUAL

Analiza individualmente:

```text
Convenios2021Seeder.php
Convenios2022Seeder.php
Convenios2023Seeder.php
Convenios2024Seeder.php
Convenios2025Seeder.php
```

Para cada uno quiero saber:

### A. Cantidad de registros

Determina cuántos registros intenta crear.

### B. Estructura

Identifica:

* campos,
* valores,
* relaciones,
* IDs,
* claves foráneas,
* referencias,
* fechas,
* estados,
* tipos,
* países,
* instituciones,
* documentos,
* cualquier otra información.

### C. Estrategia de inserción

Determina si utiliza:

```text
create
insert
insertGetId
updateOrCreate
firstOrCreate
upsert
```

o cualquier otra estrategia.

Quiero saber si el seeder es:

* idempotente,
* parcialmente idempotente,
* o no idempotente.

Esto es MUY importante.

---

# 4. DATOS HARDCODEADOS

Identifica todos los datos que estén escritos directamente en los seeders.

Especialmente:

* IDs.
* institution_id.
* agreement_id.
* nombres.
* códigos.
* fechas.
* estados.
* tipos.
* países.
* rutas de archivos.
* nombres de documentos.
* cualquier foreign key.

Determina cuáles son valores históricos reales y cuáles podrían depender del orden en que Laravel insertaba los registros.

---

# 5. DEPENDENCIAS ENTRE AÑOS

Quiero que determines si:

```text
2021
2022
2023
2024
2025
```

son independientes o si un año depende de registros creados por otro.

Por ejemplo:

```text
Convenios2021
      ↓
Institución X
      ↓
Convenios2022 utiliza esa institución
```

Si existe alguna dependencia, documenta exactamente cuál.

---

# 6. COMPARACIÓN CON LA BASE DE DATOS ACTUAL

Ahora quiero que compares los seeders con el sistema actual.

Revisa:

```text
prisma/schema.prisma
```

y toda la lógica actual relacionada con:

* instituciones,
* convenios,
* estados,
* tipos,
* roadmap,
* documentos,
* usuarios,
* relaciones.

Determina qué tablas/modelos actuales corresponden a las estructuras utilizadas por Laravel.

---

# 7. MAPEO LARAVEL → PRISMA

Quiero una tabla conceptual de mapeo.

Por ejemplo:

```text
Laravel
    ↓
Modelo/tabla actual

agreements
    ↓
Agreement

institutions
    ↓
Institution

...
```

Pero utiliza los nombres REALES encontrados en el proyecto.

Para cada entidad indica:

```text
Laravel table/model
↓
Prisma model
↓
Correspondencia
↓
Diferencias
↓
Riesgo
```

---

# 8. CAMPOS INCOMPATIBLES

Este punto es crítico.

Para cada campo utilizado por los seeders históricos determina si existe actualmente.

Clasifica:

### Compatible

El campo existe y tiene el mismo significado.

### Adaptable

Existe actualmente pero necesita transformación.

### No existe

No hay equivalente actual.

### Ambiguo

Existe algo parecido pero no podemos afirmar que tenga el mismo significado.

No inventes correspondencias.

---

# 9. ESTADOS Y ENUMS

Compara cuidadosamente los estados utilizados por Laravel con los actuales.

Por ejemplo:

```text
Laravel:
"vigente"

Prisma:
VIGENTE
```

o cualquier diferencia real que encuentres.

Revisa:

* estados,
* tipos,
* categorías,
* países,
* modalidades,
* cualquier enum.

Determina si los valores pueden insertarse directamente o necesitan transformación.

---

# 10. FECHAS

Revisa cuidadosamente cómo Laravel representa:

* fecha de inicio,
* fecha de término,
* creación,
* actualización,
* cualquier otra fecha.

Compara con Prisma/MariaDB.

Determina si:

* formatos,
* timezone,
* valores NULL,
* fechas inválidas,
* fechas históricas,

pueden generar problemas.

No transformes datos todavía.

---

# 11. IDS Y FOREIGN KEYS

Este es uno de los puntos MÁS IMPORTANTES.

Determina si los seeders Laravel dependen de IDs numéricos específicos.

Por ejemplo:

```text
institution_id = 37
agreement_id = 142
```

Necesito saber si esos IDs:

* existen actualmente,
* fueron preservados durante la migración,
* fueron reemplazados,
* pueden haber cambiado,
* dependen del orden de inserción.

**Nunca asumas que un ID histórico sigue siendo válido.**

Si no existe una correspondencia segura:

```text
DETENER
↓
documentar
↓
no insertar
```

---

# 12. DATOS YA EXISTENTES

Quiero que determines qué ocurriría si ejecutáramos actualmente los datos de esos seeders.

Analiza:

```text
Seeder
   ↓
Registro histórico
   ↓
¿Ya existe en BD?
   ↓
¿Cómo se identificaría?
```

Busca posibles duplicados utilizando identificadores de negocio reales cuando existan.

Por ejemplo:

* código de convenio,
* resolución,
* nombre,
* combinación institución + convenio,
* cualquier identificador real existente.

No utilices solamente el ID como criterio si el ID histórico puede haber cambiado.

---

# 13. RIESGO DE DUPLICACIÓN

Determina explícitamente:

* qué registros podrían duplicarse,
* qué registros podrían sobrescribirse,
* qué registros podrían fallar por unique constraint,
* qué registros podrían crear relaciones incorrectas.

Clasifica cada riesgo:

```text
CRÍTICO
ALTO
MEDIO
BAJO
```

---

# 14. DATOS QUE YA EXISTEN

Si tienes acceso a la BD local, puedes consultar datos para realizar una auditoría.

Pero:

## SOLO LECTURA.

Puedes utilizar consultas SELECT.

NO puedes:

* INSERT
* UPDATE
* DELETE
* TRUNCATE
* DROP
* ALTER
* migrate
* db push
* reset
* seed

durante esta etapa.

---

# 15. NO UTILIZAR `prisma db seed` TODAVÍA

No configures ni ejecutes:

```text
prisma db seed
```

No ejecutes:

```text
npx prisma db seed
```

ni ningún mecanismo equivalente.

Primero debemos determinar que la migración de datos es segura.

---

# 16. ¿ES REALMENTE UN SEED?

Quiero que distingas conceptualmente entre:

### Seed inicial

Datos necesarios para levantar una instalación nueva.

### Migración histórica

Datos reales provenientes del sistema anterior.

Estos archivos parecen representar principalmente una:

> **migración/carga de datos históricos**

y no simplemente un seed de desarrollo.

Determina si estás de acuerdo con esta clasificación según el contenido real.

Esto es importante porque probablemente NO deberíamos ejecutar esos datos automáticamente cada vez que alguien haga:

```text
prisma db seed
```

---

# 17. PROPUESTA DE MIGRACIÓN

Después de analizar todo, quiero que propongas cómo sería la estrategia correcta para llevar estos datos Laravel al sistema actual.

Por ejemplo, evalúa si convendría:

```text
Opción A
Script de migración one-time

Opción B
Prisma seed controlado

Opción C
Script de importación idempotente

Opción D
Adaptador temporal Laravel → Prisma

Opción E
Otra estrategia
```

No implementes todavía ninguna.

Quiero que recomiendes una y expliques por qué.

---

# 18. REQUISITO DE IDEMPOTENCIA

La solución final debería ser segura para evitar duplicados.

Idealmente:

```text
Ejecutar una vez
↓
Importa datos

Ejecutar segunda vez
↓
No duplica datos

Ejecutar tercera vez
↓
No duplica datos
```

Pero NO fuerces idempotencia mediante heurísticas peligrosas.

Primero determina cuáles son los identificadores naturales/únicos correctos.

---

# 19. PRESERVACIÓN HISTÓRICA

Los datos representan información histórica.

Por lo tanto, NO quiero que durante la futura migración:

* se modifiquen fechas históricas,
* se cambien nombres sin justificación,
* se conviertan estados arbitrariamente,
* se eliminen registros porque "parecen antiguos",
* se creen datos ficticios para completar campos.

Si un dato Laravel no tiene equivalente actual:

```text
NO inventar
↓
reportar
↓
proponer alternativa
```

---

# 20. CAMPOS OBLIGATORIOS NUEVOS

Analiza si el modelo actual de Prisma exige campos que Laravel no tenía.

Por ejemplo:

```text
Laravel:
campo opcional

Prisma:
campo obligatorio
```

Identifica todos estos casos.

Para cada uno indica:

```text
Campo
↓
Por qué es obligatorio
↓
¿Existe información histórica para rellenarlo?
↓
Si no existe, posibles alternativas
```

No inventes valores todavía.

---

# 21. RELACIONES NUEVAS

Determina si el sistema actual tiene relaciones que Laravel no tenía.

Por ejemplo:

```text
Agreement
    ↓
Roadmap
    ↓
RoadmapItem
```

Si los datos históricos no tienen información suficiente para crear esas relaciones:

**NO las inventes.**

Indica qué información falta.

---

# 22. VALIDACIÓN DE VIABILIDAD

Al finalizar la auditoría quiero una conclusión explícita:

## ¿Es viable migrar estos seeders al sistema actual?

Responde:

```text
VIABLE
VIABLE CON ADAPTACIONES
NO VIABLE TODAVÍA
```

Y explica exactamente por qué.

---

# 23. INFORME POR SEEDER

Quiero un resumen independiente:

```text
Convenios2021Seeder
- registros:
- entidades:
- dependencias:
- problemas:
- riesgos:
- viabilidad:

Convenios2022Seeder
...

Convenios2025Seeder
...
```

---

# 24. INFORME GENERAL

Después:

```text
1. Resumen ejecutivo
2. Qué hacía DatabaseSeeder
3. Qué hace cada seeder anual
4. Cantidad de datos
5. Entidades involucradas
6. Relaciones
7. Laravel → Prisma
8. Campos incompatibles
9. Estados/enums
10. IDs/FKs
11. Duplicados potenciales
12. Datos ya existentes
13. Riesgos
14. Datos faltantes
15. Estrategia recomendada
16. Idempotencia
17. Viabilidad
18. Plan de implementación propuesto
```

---

# 25. SEGUNDA FASE — SOLO DESPUÉS DE MI APROBACIÓN

Cuando termines el informe:

**DETENTE.**

No implementes todavía.

Después de revisar tu informe, yo te indicaré explícitamente si puedes pasar a la implementación.

Cuando yo diga:

> "Implementa la migración de los seeders"

recién entonces podrás:

* crear el script,
* adaptar los datos,
* utilizar Prisma,
* realizar consultas,
* preparar la carga,
* ejecutar la migración.

Y antes de ejecutar cualquier operación que pueda modificar datos existentes, deberás mostrarme:

```text
qué se va a insertar
qué se va a actualizar
qué se va a omitir
qué se detectó como duplicado
qué relaciones se van a crear
qué datos no pudieron mapearse
```

---

# REGLA ABSOLUTA

Durante esta primera etapa:

**SOLO LECTURA.**

No modificar datos.

No ejecutar seeders.

No ejecutar migraciones.

No hacer `prisma db seed`.

No hacer `prisma migrate`.

No hacer `prisma db push`.

No hacer `TRUNCATE`.

No hacer `DELETE`.

No hacer `UPDATE`.

No hacer `INSERT`.

No resetear la BD.

No modificar schema.

No modificar los seeders originales.

No "corregir" los datos históricos.

---

# OBJETIVO

Quiero que primero demuestres que entiendes completamente los seeders históricos y su relación con la base de datos actual.

Solo después de confirmar que la migración es viable decidiremos cómo implementarla.

## COMIENZA

Empieza leyendo COMPLETAMENTE:

```text
DatabaseSeeder.php
Convenios2021Seeder.php
Convenios2022Seeder.php
Convenios2023Seeder.php
Convenios2024Seeder.php
Convenios2025Seeder.php
```

Después inspecciona `prisma/schema.prisma` y las partes del backend relacionadas con Convenios e Instituciones.

No ejecutes ninguna operación de escritura.

Al terminar, entrega el informe de auditoría y DETENTE.
