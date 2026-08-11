# ETAPA 10 — REVISIÓN Y AJUSTE DE LA LÓGICA DE HOJA DE RUTA Y CONVENIO FINALIZADO

## CONTEXTO

La migración histórica de Laravel ya fue completada correctamente:

* 447 convenios.
* 393 instituciones.
* 447 roadmaps.
* 1.788 `roadmap_items`.
* 0 documentos históricos importados.
* 0 errores.
* Idempotencia verificada.

Ahora necesitamos revisar y ajustar una regla importante del negocio relacionada con la hoja de ruta, las opiniones y el documento final.

---

# REGLA DE NEGOCIO DEFINITIVA

Quiero que entiendas esta regla como una **regla general del sistema**, no como una excepción exclusiva para los convenios históricos.

## REGLA

> **Cuando un convenio tiene/sube el documento final "Convenio Firmado / Actualizado", significa que todas las opiniones correspondientes a ese trámite ya fueron validadas.**

Por lo tanto:

```text
Convenio Firmado / Actualizado
            ↓
todas las opiniones del trámite
han sido validadas
```

No importa si se trata de:

```text
Convenio histórico importado
```

o:

```text
Convenio nuevo creado manualmente
```

La regla es la misma.

---

# IMPORTANTE: NO SIGNIFICA QUE EXISTAN PDFs DE LAS OPINIONES

Esta distinción es fundamental.

Que todas las opiniones estén validadas:

```text
≠
```

que exista un PDF individual de cada opinión.

Por ejemplo, un convenio puede tener:

```text
Opinión:
VALIDADA

PDF de opinión:
NO ADJUNTADO
```

y eso es válido si existe el documento final:

```text
Convenio Firmado / Actualizado
```

Por lo tanto:

**NO crear documentos ficticios de opinión.**

No generar:

```text
opinion.pdf
opinion-validada.pdf
opinion-historica.pdf
```

si ese archivo físico no existe.

La validación de la opinión es una **regla de negocio/estado**, no necesariamente un registro documental.

---

# 1. DIFERENCIAR DOS CONCEPTOS

Quiero que distingas claramente:

### Estado de la opinión

```text
VALIDADA
```

### Existencia del documento físico de opinión

```text
PDF disponible
/
PDF no disponible
```

Son dos cosas diferentes.

El sistema debe poder representar:

```text
Opinión = VALIDADA
PDF de opinión = no adjunto
Documento final = Convenio Firmado / Actualizado
```

sin considerarlo inconsistente.

---

# 2. DOCUMENTO FINAL COMO HITO DEL TRÁMITE

El documento:

```text
Convenio Firmado / Actualizado
```

representa que el trámite alcanzó su resultado final.

Por tanto, cuando este documento existe, debe producirse la consecuencia lógica:

```text
Todas las opiniones correspondientes al trámite
→ VALIDADA
```

Esto debe funcionar para:

```text
2021
2022
2023
2024
2025
```

y también para:

```text
nuevos convenios creados posteriormente.
```

---

# 3. NO HACERLO EXCLUSIVO PARA LOS DATOS MIGRADOS

NO implementes algo como:

```text
if importedHistoricalAgreement:
    markOpinionsValidated()
```

Eso sería incorrecto.

La regla debe depender del evento/estado real:

```text
if finalSignedDocumentExists:
    opinionsAreValidated
```

La procedencia del convenio no debe importar.

---

# 4. PRIMERO AUDITA LA IMPLEMENTACIÓN ACTUAL

Antes de modificar código, revisa completamente:

### Backend

* `AgreementsService`
* `AgreementsController`
* DTOs
* Prisma schema
* `roadmap_items`
* `roadmap_documents`
* lógica de opiniones
* lógica de documentos
* tipos de documento
* estados
* entrada/salida
* activación
* progreso de roadmap

### Frontend

* `agreements/[id]/page.tsx`
* componentes de roadmap
* edición
* subida de documentos
* documentos de entrada
* documentos de salida
* sección de opiniones
* indicadores de progreso
* documentos faltantes

---

# 5. IDENTIFICA EXACTAMENTE CÓMO SE REPRESENTA UNA OPINIÓN

Quiero saber:

```text
¿Dónde se almacena actualmente una opinión?

¿Qué campo representa su estado?

¿Qué significa pendiente?

¿Qué significa validada?

¿Existe una relación entre opinión y documento?

¿La opinión depende de un documento?

¿Puede estar validada sin PDF?
```

No asumas.

Lee el código y el modelo de datos.

---

# 6. IDENTIFICA QUÉ SIGNIFICA "CONVENIO FIRMADO / ACTUALIZADO"

Determina exactamente cómo el sistema identifica:

```text
Convenio Firmado / Actualizado
```

Puede ser:

* tipo de documento;
* nombre;
* enum;
* categoría;
* combinación de campos;
* `entrada/salida`;
* área;
* otra lógica.

Quiero que utilices la implementación existente.

NO inventes un nuevo tipo de documento si ya existe.

---

# 7. FLUJO ESPERADO

El flujo de negocio que debemos soportar es:

```text
┌──────────────────────────────┐
│ CREAR CONVENIO               │
└──────────────┬───────────────┘
               ↓
       Hoja de ruta
               ↓
      Áreas / opiniones
               ↓
    Opiniones en proceso
               ↓
     Opiniones validadas
               ↓
┌──────────────────────────────┐
│ Convenio Firmado / Actual.   │
│          PDF                  │
└──────────────┬───────────────┘
               ↓
     TRÁMITE FINALIZADO
               ↓
   Todas las opiniones
        = VALIDADA
```

La aplicación debe representar correctamente esta secuencia.

---

# 8. CUANDO SE SUBE EL DOCUMENTO FINAL

Cuando el usuario haga:

```text
Edit
→ Subir un nuevo documento (PDF)
→ Convenio Firmado / Actualizado
```

el sistema debe reconocer que:

```text
finalDocument = true
```

y, como consecuencia lógica:

```text
todas las opiniones correspondientes
→ VALIDADA
```

No quiero que el usuario tenga que entrar posteriormente a cada opinión y marcarla manualmente como validada si el documento final ya demuestra que el trámite terminó.

---

# 9. ¿QUÉ SIGNIFICA "TODAS LAS OPINIONES"?

No asumas que existe una cantidad fija.

Inspecciona cómo funciona actualmente la hoja de ruta.

Determina:

* qué áreas generan opiniones;
* qué áreas requieren opinión;
* qué áreas no requieren opinión;
* si todas las áreas tienen la misma estructura;
* si existen diferentes tipos de trámite.

La regla debe aplicarse a:

> todas las opiniones que realmente correspondan a ese convenio/trámite.

No crear opiniones inexistentes.

---

# 10. DOCUMENTOS FALTANTES

El documento final NO debe provocar automáticamente que desaparezcan todos los documentos faltantes.

Ejemplo:

```text
Convenio Firmado / Actualizado
        ↓
Opiniones = VALIDADA
```

pero podrían seguir existiendo:

```text
Documento histórico no disponible
```

si la hoja de ruta requiere información que no está registrada.

Por eso debes analizar cuidadosamente qué significa actualmente:

```text
documento faltante
```

y separar:

### Estado de opinión

de:

### Existencia documental

---

# 11. PROGRESO DE LA HOJA DE RUTA

Aquí quiero especial cuidado.

Analiza si actualmente el progreso depende de:

```text
opiniones
documentos
envíos
áreas
```

o de una combinación.

Después determina:

> ¿Qué debería ocurrir con el progreso cuando se sube "Convenio Firmado / Actualizado"?

No inventes una fórmula nueva.

Primero comprende la actual.

Si hace falta modificarla, explica exactamente:

```text
Fórmula actual
→
Problema
→
Fórmula propuesta
```

---

# 12. CASO HISTÓRICO

Los 447 convenios históricos actualmente tienen:

```text
Convenio existente
+
Roadmap generado
+
0 documentos históricos
```

Posteriormente voy a cargar manualmente el PDF final de cada convenio.

Ejemplo:

```text
Convenio 001-2021
        ↓
Edit
        ↓
Subir PDF
        ↓
Convenio Firmado / Actualizado
```

En ese momento debe ocurrir correctamente:

```text
Documento final registrado
        ↓
Opiniones = VALIDADA
```

sin necesidad de subir PDFs históricos de las opiniones.

---

# 13. CASO DE CONVENIO NUEVO

Este mismo comportamiento debe funcionar para un convenio nuevo.

Ejemplo:

```text
Usuario crea convenio
        ↓
Roadmap
        ↓
Opiniones pendientes
        ↓
Usuario completa el trámite
        ↓
Sube Convenio Firmado / Actualizado
        ↓
Opiniones = VALIDADA
```

Por tanto, NO crear una condición especial para los convenios migrados.

---

# 14. CASO SIN DOCUMENTO FINAL

Si todavía NO existe:

```text
Convenio Firmado / Actualizado
```

NO asumir que todas las opiniones están validadas.

Ejemplo:

```text
Convenio en trámite
+
sin documento final
+
opiniones pendientes
```

debe continuar funcionando como actualmente.

---

# 15. CASO DE DOCUMENTOS DE ENTRADA / SALIDA

Revisa cuidadosamente la distinción:

```text
DOC. ENTRADA
DOC. SALIDA
```

y cómo se clasifica:

```text
Convenio Firmado / Actualizado
```

El documento final debe almacenarse en la clasificación correcta.

Recuerda el bug anterior donde el primer documento de salida podía terminar almacenado como entrada debido a un estado stale de React.

Ese bug ya fue corregido.

Verifica que continúe corregido.

NO reemplaces esa solución por una dependencia implícita del estado de React.

---

# 16. EVENTO VS ESTADO

Quiero que determines si técnicamente es mejor implementar la regla como:

```text
evento:
al subir documento final
→ validar opiniones
```

o como:

```text
estado derivado:
si existe documento final
→ opiniones aparecen como validadas
```

Analiza cuál encaja mejor con la arquitectura actual.

No implementes ambas.

No dupliques estado innecesariamente.

Prioriza la arquitectura existente.

---

# 17. CONSISTENCIA

La regla debe mantenerse consistente si:

```text
se sube el documento final
```

y también si:

```text
se vuelve a consultar el convenio
```

No quiero una validación que exista solamente en memoria del frontend.

La lógica debe funcionar realmente en backend/BD cuando corresponda.

---

# 18. EDICIÓN Y ELIMINACIÓN

Analiza qué ocurre si:

```text
se sube Convenio Firmado / Actualizado
```

y posteriormente:

```text
se elimina ese documento.
```

Esto es MUY importante.

Determina qué debería suceder con:

```text
opiniones validadas
```

No inventes una regla.

Si actualmente el sistema no tiene definida esta situación, repórtala como:

```text
DECISIÓN DE NEGOCIO PENDIENTE
```

No implementes automáticamente una reversión de opinión sin autorización.

---

# 19. NO MODIFICAR DATOS MASIVAMENTE TODAVÍA

Aunque los 447 convenios históricos ya están importados:

**NO ejecutes todavía un UPDATE masivo.**

No hagas:

```text
UPDATE 447 agreements...
```

No marques automáticamente todas las áreas.

No marques automáticamente todas las opiniones.

Primero quiero que la lógica quede correctamente implementada y probada.

Después podremos decidir cómo preparar los 447 convenios.

---

# 20. NO CREAR DOCUMENTOS FICTICIOS

Reitero:

Los 447 convenios históricos tienen un documento físico final real que posteriormente será cargado.

Pero actualmente los PDFs no están disponibles en el workspace.

Por tanto:

NO crear:

```text
documentos placeholder
```

NO crear:

```text
opiniones PDF ficticias
```

NO crear:

```text
documentos históricos inexistentes
```

---

# 21. CAMBIOS DE SCHEMA

NO modificar Prisma schema.

NO ejecutar:

```text
prisma migrate
prisma db push
ALTER TABLE
```

Si consideras imprescindible un cambio de schema:

**DETENTE y explícame antes.**

---

# 22. FASES DE TRABAJO

Trabaja así:

### FASE 1 — Comprensión

Leer completamente la implementación actual.

### FASE 2 — Análisis

Determinar:

* cómo funcionan opiniones;
* cómo funcionan documentos;
* cómo funciona el roadmap;
* cómo funciona progreso;
* cómo se identifica documento final;
* cómo funciona entrada/salida.

### FASE 3 — Diseño

Proponer la forma más coherente de implementar:

```text
Convenio Firmado / Actualizado
        ↓
todas las opiniones correspondientes
        ↓
VALIDADA
```

### FASE 4 — Implementación

Implementar solamente los cambios necesarios.

No modificar otras funcionalidades.

### FASE 5 — Verificación

Probar:

1. convenio nuevo;
2. convenio histórico;
3. opinión pendiente;
4. documento final;
5. opinión validada sin PDF;
6. DOC. ENTRADA;
7. DOC. SALIDA;
8. Convenio Firmado / Actualizado;
9. roadmap;
10. progreso.

### FASE 6 — Informe

Explicar:

* qué encontraste;
* qué modificaste;
* por qué;
* qué archivos modificaste;
* cómo funciona ahora;
* qué pruebas ejecutaste;
* qué quedó pendiente.

---

# 23. CRITERIO DE ÉXITO

La implementación será correcta si:

### Antes del documento final

```text
Opiniones
→ pueden estar pendientes
```

### Después de subir:

```text
Convenio Firmado / Actualizado
```

el sistema reconoce:

```text
Todas las opiniones correspondientes
→ VALIDADA
```

aunque:

```text
PDF individual de opinión
→ NO exista
```

y sin crear documentos ficticios.

Además:

```text
Convenio histórico
```

y:

```text
Convenio nuevo
```

deben comportarse bajo la misma regla.

---

# 24. REGLA MÁS IMPORTANTE DE TODA LA ETAPA

Grábate esta regla como requisito funcional:

> **"Convenio Firmado / Actualizado" es la evidencia de que todas las opiniones correspondientes al trámite ya fueron validadas.**

No es solamente un documento más.

Es el **hito final del trámite**.

Por tanto, la existencia de ese documento debe tener la consecuencia de negocio correspondiente sobre las opiniones.

Pero:

```text
Opinión validada
≠
PDF de opinión existente
```

y:

```text
Documento final
≠
inventar documentos históricos previos
```

---

# COMIENZA

Empieza leyendo y entendiendo completamente la implementación actual.

No hagas cambios masivos de datos.

No inventes documentos.

No cambies schema.

No normalices instituciones.

No modifiques funcionalidades no relacionadas.

Implementa únicamente lo necesario para que la regla:

```text
Convenio Firmado / Actualizado
        ↓
Todas las opiniones correspondientes = VALIDADA
```

sea una regla real, coherente y reutilizable tanto para los 447 convenios históricos como para todos los convenios nuevos que se creen posteriormente.

Al terminar, entrega el informe completo y detente.
