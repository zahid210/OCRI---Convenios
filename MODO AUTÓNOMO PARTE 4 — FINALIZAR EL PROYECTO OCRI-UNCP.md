# ETAPA 7 — CORRECCIÓN DE DOCUMENTOS + HEADER FUNCIONAL

Antes de comenzar esta etapa, una aclaración importante:

## JWT / roles

**NO implementes todavía la recomendación relacionada con JWT.**

El análisis realizado anteriormente es correcto y queda pendiente de decisión.

No modifiques:

* `JwtStrategy.validate()`
* comportamiento de roles dentro del JWT
* expiración del JWT
* estrategia de autenticación

salvo que una corrección de esta etapa lo requiera directamente, lo cual en principio no debería ocurrir.

El tema JWT lo revisaremos posteriormente.

---

# OBJETIVO DE ESTA ETAPA

Quiero trabajar ahora en dos áreas:

## A. Corregir un problema real con documentos de la hoja de ruta.

## B. Hacer funcional TODO el contenido del layout/header que actualmente existe, tanto frontend como backend.

No quiero solamente corregir la interfaz visual.

Si una función del header necesita API, endpoint, consulta a BD, estado global, autenticación o integración con backend, debes implementarla de extremo a extremo respetando la arquitectura existente.

---

# PARTE A — BUG CRÍTICO: DOC. SALIDA / DOC. ENTRADA

Actualmente existe un problema al adjuntar documentos dentro de los trámites de la hoja de ruta.

## Comportamiento actual

Cuando intento subir un documento en:

> **DOC. SALIDA**

el documento termina apareciendo inicialmente en:

> **DOC. ENTRADA**

Esto ocurre en los trámites que utilizan este mecanismo.

Después sucede algo extraño:

1. Subo un documento en `DOC. SALIDA`.
2. El documento aparece incorrectamente en `DOC. ENTRADA`.
3. Elimino ese documento incorrectamente asociado desde `DOC. ENTRADA`.
4. Vuelvo a intentar subir el documento en `DOC. SALIDA`.
5. En el segundo intento el documento sí aparece correctamente en `DOC. SALIDA`.

Este comportamiento indica que existe probablemente un problema en el flujo de:

* selección del documento,
* identificación del tipo,
* estado del formulario,
* asociación al `roadmap_item`,
* asociación al `roadmap_document`,
* creación del registro,
* actualización del estado,
* estado local de React,
* caché,
* revalidación,
* eliminación,
* o combinación frontend/backend.

**No asumas la causa. Investígala.**

---

# INVESTIGACIÓN OBLIGATORIA DEL BUG

Antes de modificar código, reconstruye el flujo completo.

Debes localizar:

### Frontend

* Componente donde se muestra `DOC. ENTRADA`.
* Componente donde se muestra `DOC. SALIDA`.
* Modal/formulario de subida.
* Estado seleccionado del tipo de documento.
* Función que ejecuta el upload.
* Función que elimina documentos.
* Función que refresca los documentos.
* Estado local utilizado para representar los documentos.
* Cualquier lógica que determine `entrada` / `salida`.

### Backend

Localiza:

* Controller relacionado.
* Endpoint de upload.
* DTO utilizado.
* Service.
* Prisma.
* Modelo relacionado.
* Campo que identifica entrada/salida.
* Relaciones con `roadmap_items`.
* Relaciones con `roadmap_documents`.
* Lógica de creación.
* Lógica de eliminación.
* Lógica de consulta.

---

# RECONSTRUIR EL FLUJO

Quiero que determines exactamente qué ocurre:

```text
Usuario
   ↓
Selecciona trámite
   ↓
Selecciona DOC. ENTRADA / DOC. SALIDA
   ↓
Selecciona archivo
   ↓
Frontend construye request
   ↓
HTTP request
   ↓
NestJS Controller
   ↓
DTO / parámetros
   ↓
Service
   ↓
Prisma
   ↓
MariaDB
   ↓
Documento persistido
   ↓
Response
   ↓
Frontend actualiza estado
   ↓
Documento aparece en la sección correcta
```

Compara específicamente el primer intento con el segundo intento.

Quiero que identifiques qué cambia entre ambos.

---

# INVESTIGACIÓN DEL PRIMER Y SEGUNDO INTENTO

Debes determinar si el problema ocurre:

### Antes de llegar al backend

Por ejemplo:

* El frontend envía incorrectamente el tipo.
* El estado tiene un valor anterior.
* El formulario conserva el tipo anterior.
* El `FormData` se construye incorrectamente.
* Se utiliza un ID incorrecto.
* Existe una condición de render incorrecta.

### Durante el backend

Por ejemplo:

* El backend ignora el tipo enviado.
* Se utiliza un valor por defecto.
* El service obtiene el documento equivocado.
* La relación se crea incorrectamente.
* Se interpreta incorrectamente un campo.

### Después de guardar

Por ejemplo:

* La BD tiene correctamente `SALIDA`, pero el frontend muestra el documento en `ENTRADA`.
* El estado local se actualiza utilizando información incorrecta.
* La respuesta del endpoint no coincide con la estructura esperada.
* Se está utilizando información antigua.
* Existe un problema de cache/revalidación.

---

# NO ACEPTAR UNA SOLUCIÓN SUPERFICIAL

No quiero una solución del tipo:

> "Después de subir, mueve visualmente el documento a DOC. SALIDA."

Quiero que el documento se cree y persista **correctamente desde el primer intento**.

La fuente de verdad debe ser coherente:

```text
Frontend
   ↕
API
   ↕
Backend
   ↕
BD
```

Si el documento es `DOC. SALIDA`, debe quedar realmente registrado como `DOC. SALIDA`.

---

# PRUEBA OBLIGATORIA

Después de corregirlo, verifica como mínimo:

### Caso 1

Subir un documento nuevo en `DOC. ENTRADA`.

Resultado esperado:

```text
DOC. ENTRADA → documento correcto
DOC. SALIDA  → no aparece ese documento
```

### Caso 2

Subir un documento nuevo en `DOC. SALIDA`.

Resultado esperado:

```text
DOC. ENTRADA → no aparece ese documento
DOC. SALIDA  → documento correcto
```

### Caso 3

Subir varios documentos consecutivamente en:

```text
ENTRADA
SALIDA
ENTRADA
SALIDA
```

Cada uno debe permanecer en su categoría correcta.

### Caso 4

Eliminar un documento y volver a subir otro.

La clasificación debe continuar funcionando correctamente.

### Caso 5

Recargar completamente la página después de subir.

La ubicación debe seguir siendo correcta después de consultar nuevamente al backend.

### Caso 6

Si existen diferentes trámites que utilizan este componente, verifica que la corrección no funcione solamente para un trámite específico.

---

# PARTE B — HEADER COMPLETAMENTE FUNCIONAL

Actualmente el layout del sistema tiene un header con diferentes elementos.

Quiero que revises **todo lo que actualmente existe en el header**.

No quiero limitar esta tarea únicamente al buscador y la campana.

Primero realiza un inventario de los elementos actuales.

Por ejemplo, si existen:

* Logo / navegación.
* Buscador.
* Notificaciones.
* Información del usuario.
* Avatar.
* Nombre.
* Rol.
* Menú de usuario.
* Cerrar sesión.
* Otros botones o acciones.

Analiza cada elemento y determina:

```text
Elemento
↓
¿Actualmente funciona?
↓
¿Es solamente visual?
↓
¿Tiene interacción?
↓
¿Necesita backend?
↓
¿Necesita endpoint?
↓
¿Necesita BD?
```

---

# BÚSQUEDA DEL HEADER

El buscador debe dejar de ser solamente visual.

Quiero que funcione realmente.

Antes de implementarlo, analiza qué debería buscar utilizando los datos existentes del sistema.

Como mínimo, debe poder encontrar información relevante de:

* Convenios.
* Instituciones.

Si existe información adicional claramente indexable y útil en el sistema, puedes proponerla.

No inventes entidades que no existan.

---

# EXPERIENCIA ESPERADA DEL BUSCADOR

El usuario debería poder:

```text
Escribir búsqueda
      ↓
Obtener resultados relevantes
      ↓
Seleccionar resultado
      ↓
Navegar a la entidad correspondiente
```

Por ejemplo:

```text
Buscar institución
       ↓
Resultado
       ↓
Institución correspondiente
```

o:

```text
Buscar convenio
       ↓
Resultado
       ↓
Detalle del convenio
```

---

# BÚSQUEDA — BACKEND

No quiero cargar todos los registros innecesariamente en el navegador para hacer un filtro local si el sistema puede realizar la búsqueda correctamente mediante backend.

Analiza la arquitectura existente.

Si es necesario:

* Crear endpoint.
* Crear DTO.
* Crear método en service.
* Utilizar Prisma.
* Agregar búsqueda por campos relevantes.

Hazlo respetando los patrones existentes.

La búsqueda debe:

* manejar texto vacío,
* manejar resultados inexistentes,
* manejar loading,
* manejar errores,
* evitar requests innecesarios,
* mostrar resultados claramente,
* navegar correctamente.

Si necesitas debounce, puedes implementarlo siguiendo un patrón sencillo y coherente con el proyecto.

No agregues una librería solamente para esto si puede resolverse con React/Next existente.

---

# NOTIFICACIONES — CAMPANITA

La campanita del header también debe funcionar realmente.

No quiero simplemente un dropdown visual con información falsa.

Primero analiza qué información existente en el sistema puede representar una notificación útil.

Por ejemplo, si los datos existentes permiten identificar:

* Convenios próximos a vencer.
* Convenios vencidos.
* Trámites pendientes.
* Documentos faltantes.
* Opiniones pendientes.
* Etapas de hoja de ruta pendientes.
* Otros eventos realmente existentes.

puedes utilizar esa información.

Pero:

**NO inventes eventos o notificaciones que no estén respaldados por datos reales del sistema.**

---

# NOTIFICACIONES — REGLA IMPORTANTE

Primero determina qué puede considerarse realmente una notificación según los datos actuales.

Después propón la estructura.

Puede ser algo como:

```text
Campana
   ↓
Cantidad de pendientes
   ↓
Dropdown
   ├── Convenio X próximo a vencer
   ├── Convenio Y tiene documentos pendientes
   └── Convenio Z tiene una etapa pendiente
```

Pero esto es solo un ejemplo conceptual.

Utiliza los datos reales disponibles.

---

# NOTIFICACIONES — BACKEND

Si la arquitectura existente requiere backend para obtener las notificaciones:

implementa:

```text
Controller
   ↓
Service
   ↓
Prisma
   ↓
BD
```

No hardcodees notificaciones.

Si las notificaciones pueden calcularse directamente de información existente sin crear una nueva tabla, prioriza esa opción.

No agregues una tabla `notifications` solamente para hacer funcionar la campana si no existe una necesidad real.

---

# ESTADO DE LEÍDO / NO LEÍDO

Analiza si actualmente existe infraestructura para manejar:

* leído,
* no leído,
* fecha,
* usuario,
* tipo.

Si no existe, determina si realmente es necesario para la primera versión.

Si implementar "leído/no leído" requiere cambios de schema:

**NO modifiques la BD todavía.**

Explícame primero qué cambio sería necesario.

La primera versión puede ser una lista calculada de pendientes si eso permite que la campana sea funcional sin modificar el schema.

---

# HEADER Y AUTENTICACIÓN

El header debe respetar el usuario actualmente autenticado.

Debe utilizar la fuente de usuario que ya implementaste durante la solución de hydration:

```text
UserProvider / useUser()
```

No vuelvas a introducir lecturas directas de `document.cookie` durante el render.

Mantén la solución SSR/cliente actual.

---

# CIERRE DE SESIÓN

Revisa también el botón/acción de cerrar sesión si existe en el header o menú de usuario.

Debe:

* eliminar correctamente la sesión,
* limpiar el estado de usuario,
* redirigir correctamente al login,
* no dejar la UI mostrando información del usuario anterior.

Si ya funciona correctamente, no lo modifiques innecesariamente.

---

# NO ROMPER LA SOLUCIÓN DE HYDRATION

Esta tarea se realiza DESPUÉS de la corrección de hydration.

Por lo tanto:

**No vuelvas a introducir:**

```tsx
Cookies.get(...)
```

durante el render de componentes que participan en SSR.

No introduzcas:

```tsx
typeof window !== "undefined"
```

para producir HTML diferente entre servidor y cliente.

No utilices `suppressHydrationWarning` como solución.

Mantén el patrón:

```text
Server Layout
      ↓
cookies()
      ↓
UserProvider
      ↓
useUser()
      ↓
Componentes
```

cuando corresponda.

---

# ALCANCE

Durante esta etapa sí puedes modificar:

* Frontend.
* Backend.
* Controllers.
* Services.
* DTOs.
* API helpers.
* Componentes.
* Hooks.
* Contextos.
* Prisma queries.

Pero:

## No modificar schema de BD

Si descubres que alguna parte de las notificaciones requiere:

* nueva tabla,
* nueva columna,
* nueva relación,

detente y explícame primero.

No ejecutes migraciones.

---

# VERIFICACIÓN DEL BUG DE DOCUMENTOS

Quiero que la verificación sea real y no solamente estática.

Comprueba:

* Request enviado.
* Parámetros.
* Response.
* Registro persistido cuando sea posible.
* Render posterior.
* Recarga de página.

El criterio principal es:

> **El primer upload debe quedar correctamente clasificado.**

---

# VERIFICACIÓN DEL HEADER

Comprueba:

### Buscador

* búsqueda válida,
* sin resultados,
* loading,
* error,
* navegación al resultado.

### Notificaciones

* cantidad,
* listado,
* navegación,
* datos reales,
* caso sin notificaciones.

### Usuario

* nombre,
* rol,
* información correcta.

### Logout

* cerrar sesión correctamente.

### SSR/Hydration

Después de implementar las nuevas funcionalidades:

* no deben reaparecer hydration errors,
* no debe aparecer `Hydration failed`,
* no debe aparecer HTML inválido.

---

# VERIFICACIÓN FINAL

Ejecuta:

## Backend

* `tsc --noEmit`
* ESLint
* `nest build`
* tests relevantes

## Frontend

* `tsc --noEmit`
* ESLint
* `next build`

Además realiza pruebas runtime de las rutas afectadas.

Especialmente:

```text
/dashboard
/agreements
/agreements/[id]
/institutions
/reports
/seguimiento
/users
```

y las rutas relacionadas con la hoja de ruta/documentos.

---

# INFORME FINAL

Al terminar, entrégame:

## 1. Bug DOC. ENTRADA / DOC. SALIDA

* Causa raíz.
* Archivos afectados.
* Corrección realizada.
* Cómo se verificó.
* Resultado del primer upload.

## 2. Header

### Buscador

* Qué busca.
* Endpoint utilizado.
* Cómo navega.
* Manejo de estados.

### Notificaciones

* Qué eventos muestra.
* De dónde obtiene los datos.
* Endpoint utilizado.
* Cómo funciona.

### Usuario

* Qué información muestra.

### Logout

* Cómo funciona.

## 3. Backend

Endpoints nuevos/modificados.

## 4. Frontend

Componentes/hooks/contextos modificados.

## 5. Base de datos

Indicar explícitamente:

```text
Schema: sin cambios
```

o explicar exactamente qué cambio se requiere.

## 6. Verificación

Indicar resultados de:

* tsc
* eslint
* build
* tests
* runtime
* hydration

## 7. Problemas restantes

Lista cualquier problema encontrado que no hayas solucionado.

---

# REGLAS FINALES

Recuerda:

* No inventar reglas de negocio.
* No modificar JWT en esta etapa.
* No cambiar schema sin autorización.
* No hacer operaciones destructivas.
* No ocultar hydration errors.
* No introducir librerías innecesarias.
* No hacer refactors generales.
* Reutilizar la arquitectura existente.
* Corregir la causa real del bug.
* Implementar las funcionalidades de extremo a extremo.

Si una decisión técnica menor puede resolverse siguiendo los patrones existentes, decide tú y continúa.

Si aparece una decisión de negocio importante o un cambio de schema:

**DETENTE Y PREGÚNTAME.**

## COMIENZA

Empieza por la **investigación del bug DOC. ENTRADA / DOC. SALIDA**.

Después continúa con la auditoría e implementación del **header completo**.

No vuelvas a analizar todo el proyecto desde cero; utiliza todo el contexto y conocimiento acumulado durante las etapas anteriores.
