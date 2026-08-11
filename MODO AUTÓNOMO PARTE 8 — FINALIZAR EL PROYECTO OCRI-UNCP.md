# ETAPA 11 — UNIFICACIÓN DE ALERTAS NATIVAS EN UI DEL SISTEMA

## OBJETIVO

Quiero eliminar del proyecto el uso de `alert()` y, donde corresponda, otros diálogos nativos del navegador como `confirm()` y `prompt()`.

En lugar de utilizar ventanas nativas del navegador, el sistema debe utilizar **componentes visuales integrados dentro de la propia interfaz**, respetando completamente el diseño, arquitectura y estilo visual que ya tiene el proyecto.

La experiencia debe sentirse como parte natural de la aplicación, no como una ventana del navegador.

---

# REGLA PRINCIPAL

A partir de esta etapa:

```text
❌ alert()
❌ window.alert()
❌ confirm()
❌ window.confirm()
❌ prompt()
❌ window.prompt()
```

NO deben utilizarse para las interacciones normales de la aplicación.

Deben reemplazarse por componentes UI apropiados.

---

# 1. PRIMERO AUDITA TODO EL PROYECTO

Antes de modificar código, realiza una búsqueda completa en:

```text
ocri-frontend/
ocri-backend/
```

especialmente:

```text
src/**/*.tsx
src/**/*.ts
```

Busca:

```text
alert(
window.alert(
confirm(
window.confirm(
prompt(
window.prompt(
```

También busca implementaciones equivalentes o wrappers propios que terminen mostrando una alerta nativa.

Quiero conocer:

* dónde se utilizan;
* qué propósito tiene cada uno;
* si es mensaje de éxito;
* error;
* advertencia;
* información;
* confirmación destructiva;
* confirmación de navegación;
* validación;
* resultado de una operación backend.

---

# 2. NO REEMPLACES TODO CON EL MISMO COMPONENTE

Esto es muy importante.

No quiero simplemente convertir:

```text
alert("Guardado correctamente")
```

en:

```text
<Modal>Guardado correctamente</Modal>
```

para absolutamente todo.

Analiza el contexto y utiliza el patrón adecuado.

Por ejemplo:

### Éxito

Para:

```text
Guardado correctamente
Actualizado correctamente
Documento subido correctamente
Convenio creado correctamente
```

preferir:

```text
Toast / notificación temporal
```

si el proyecto ya dispone de un patrón compatible.

---

### Error

Para errores importantes:

```text
No se pudo guardar
Error al subir el documento
Error de conexión
```

usar:

```text
Toast de error
```

o una ventana integrada si el usuario necesita leer/interactuar con el mensaje.

---

### Advertencia

Para:

```text
No se pudo completar la operación
Faltan datos
Esta acción requiere...
```

utilizar una UI visual coherente con el sistema.

---

### Acciones destructivas

Para acciones como:

```text
Eliminar convenio
Eliminar institución
Eliminar usuario
Eliminar documento
```

NO utilizar `confirm()`.

Debe utilizarse un:

```text
Modal de confirmación
```

integrado en la página.

Ejemplo conceptual:

```text
┌──────────────────────────────────────┐
│ ¿Eliminar convenio?                  │
│                                      │
│ Esta acción no se puede deshacer.    │
│                                      │
│        Cancelar      Eliminar        │
└──────────────────────────────────────┘
```

El botón destructivo debe respetar los estilos existentes del proyecto.

---

# 3. RESPETAR EL FRONTEND EXISTENTE

No quiero introducir un diseño completamente diferente.

Antes de crear componentes nuevos, revisa si el proyecto ya tiene:

* Modal;
* Dialog;
* Toast;
* notification;
* Alert;
* Button;
* Card;
* componentes reutilizables;
* estilos globales;
* utilidades;
* librerías UI existentes.

Si ya existe una solución adecuada:

**REUTILÍZALA.**

No dupliques componentes.

No instales una librería nueva si no es necesaria.

No introduzcas:

```text
Material UI
Chakra
Ant Design
Shadcn
Radix
SweetAlert
React Hot Toast
Sonner
```

ni ninguna otra librería nueva simplemente para resolver esto, salvo que descubras que el proyecto ya utiliza alguna.

La prioridad es:

```text
arquitectura existente
+
componentes existentes
+
estilos existentes
```

---

# 4. SI NO EXISTE UN SISTEMA CENTRALIZADO

Si descubres que actualmente no existe un sistema reutilizable para:

```text
toast
modal
confirmación
```

entonces diseña uno pequeño y coherente con el proyecto.

Por ejemplo, podría existir algo conceptualmente similar a:

```text
components/ui/
    modal.tsx
    toast.tsx
    confirm-dialog.tsx
```

Pero NO asumas estos nombres.

Primero revisa la estructura actual.

El objetivo es tener una solución reutilizable, no crear componentes diferentes para cada página.

---

# 5. LOS MODALES DEBEN SER REALMENTE MODALES

No quiero reemplazar `alert()` con una navegación a otra página.

La interacción debe permanecer en la página actual.

Ejemplo:

```text
Usuario elimina documento
        ↓
Modal aparece
        ↓
Usuario confirma
        ↓
Backend procesa DELETE
        ↓
Modal se cierra
        ↓
Toast:
"Documento eliminado correctamente"
```

---

# 6. MENSAJES DE BACKEND

Revisa también cómo actualmente se manejan los errores provenientes del backend.

Por ejemplo:

```text
400
401
403
404
409
500
```

Si actualmente terminan en:

```text
alert(error.message)
```

deben pasar a la nueva UI.

No ocultes información útil del backend.

Por ejemplo, si el backend devuelve:

```text
La institución ya existe
```

el usuario debe seguir viendo ese mensaje, pero dentro del sistema.

---

# 7. ESTADOS DE LOADING

Aprovecha esta auditoría para comprobar que las acciones que sustituyan alertas/modal tengan estados apropiados.

Por ejemplo:

```text
Eliminar
   ↓
"Eliminando..."
   ↓
operación terminada
   ↓
"Eliminado correctamente"
```

Evita que el usuario pueda hacer doble click y ejecutar dos veces la misma operación mientras está procesándose.

Lo mismo para:

```text
Guardar
Actualizar
Subir documento
Eliminar documento
Crear convenio
Crear institución
Activar convenio
Eliminar usuario
Cambiar rol
```

No implementes cambios no relacionados; solo corrige el flujo cuando sea necesario para que la nueva UI funcione correctamente.

---

# 8. DOCUMENTOS

Presta especial atención a:

```text
Subir documento
Eliminar documento
DOC. ENTRADA
DOC. SALIDA
Convenio Firmado / Actualizado
```

Ya existe una lógica importante alrededor de estos documentos.

No la rompas.

El objetivo de esta etapa es únicamente cambiar la forma en que se informa/confirma al usuario.

No modificar la lógica de:

```text
entrada
salida
opiniones
Convenio Firmado / Actualizado
roadmap
```

salvo que sea estrictamente necesario para sustituir la interacción nativa.

---

# 9. NO USAR suppressHydrationWarning

La solución debe ser compatible con la arquitectura actual de Next.js.

NO solucionar problemas de UI mediante:

```text
suppressHydrationWarning
```

ni introducir lógica dependiente de:

```text
typeof window !== 'undefined'
```

solo para hacer funcionar los modales/toasts.

Los componentes deben renderizarse correctamente tanto en SSR como en cliente según corresponda.

---

# 10. ACCESIBILIDAD

Los modales deben comportarse correctamente:

* botón cerrar;
* Escape;
* foco razonable;
* botones claramente diferenciados;
* texto legible;
* no permitir interacción accidental con el contenido inferior mientras el modal está activo.

Para confirmaciones destructivas:

```text
Cancelar
Eliminar
```

deben estar claramente diferenciados.

---

# 11. RESPONSIVE

Comprueba que las ventanas funcionen correctamente en:

```text
desktop
tablet
mobile
```

No quiero modales que se salgan de la pantalla.

---

# 12. NO MODIFICAR BACKEND SIN NECESIDAD

Esta etapa es principalmente de UX/frontend.

No modifiques:

```text
schema Prisma
BD
endpoints
DTOs
servicios backend
```

si no existe una necesidad real.

Si encuentras que algún cambio backend es estrictamente necesario, primero analízalo y explícame por qué.

---

# 13. NO CAMBIAR REGLAS DE NEGOCIO

No modificar las reglas actuales de:

```text
Convenios
Instituciones
Usuarios
Roles
Roadmap
Opiniones
Documentos
Reportes
Seguimiento
Notificaciones
```

Esta etapa solamente debe mejorar la interacción visual.

---

# 14. CONSERVAR EL ESTILO VISUAL

Analiza:

* colores actuales;
* bordes;
* sombras;
* radios;
* tipografía;
* botones;
* iconos;
* animaciones;
* estados hover;
* estados disabled.

Los nuevos componentes deben parecer que siempre formaron parte del sistema.

No crear un diseño genérico independiente.

---

# 15. IMPLEMENTACIÓN CENTRALIZADA

Si existen suficientes usos de alertas como para justificarlo, crea una API reutilizable.

Por ejemplo, conceptualmente:

```text
showSuccess(...)
showError(...)
showWarning(...)
showInfo(...)
showConfirm(...)
```

Pero decide tú la implementación después de inspeccionar la arquitectura actual.

No copies la lógica de modal en 20 páginas diferentes.

Quiero:

```text
componente reutilizable
        ↓
páginas
        ↓
usan el mismo sistema
```

---

# 16. CONFIRMACIONES ASÍNCRONAS

Si actualmente existe:

```text
if (confirm("¿Eliminar?")) {
    await delete(...)
}
```

la nueva solución debe permitir algo equivalente a:

```text
const confirmed = await confirm(...)
```

o el patrón que mejor encaje con la arquitectura existente.

El usuario debe poder:

```text
Cancelar
```

sin ejecutar la operación.

Y:

```text
Confirmar
```

para continuar.

---

# 17. AUDITORÍA FINAL

Después de implementar:

Haz una búsqueda nuevamente de:

```text
alert(
window.alert(
confirm(
window.confirm(
prompt(
window.prompt(
```

El objetivo es:

```text
0 usos funcionales
```

Si queda alguno por una razón técnica legítima, indícalo explícitamente.

No ocultes resultados simplemente para hacer que el escaneo aparezca limpio.

---

# 18. VERIFICACIÓN

Ejecuta:

### Backend

```text
tsc --noEmit
eslint
nest build
```

### Frontend

```text
tsc --noEmit
eslint
next build
```

Además realiza pruebas funcionales de:

```text
Crear
Editar
Eliminar
Guardar
Subir documento
Eliminar documento
Activar convenio
Cambiar rol
Eliminar institución
```

en los casos donde actualmente exista una alerta/confirmación.

Comprueba:

```text
éxito
error
cancelación
loading
```

---

# 19. CRITERIO DE ÉXITO

Al finalizar quiero que:

```text
❌ alert nativo
❌ confirm nativo
❌ prompt nativo
```

hayan sido reemplazados por:

```text
✅ Toasts
✅ Modales
✅ Confirmaciones integradas
✅ Mensajes visuales coherentes
```

y que todo parezca parte del mismo sistema.

---

# 20. REGLA IMPORTANTE

No aproveches esta tarea para hacer un refactor general.

No corrijas:

* warnings preexistentes;
* arquitectura;
* JWT;
* módulos futuros;
* schema;
* seeders;
* instituciones ambiguas;
* funcionalidades pendientes;

salvo que sea estrictamente necesario para esta etapa.

Si encuentras problemas no relacionados:

```text
→ regístralos
→ no los modifiques
```

---

# FASES

Trabaja siguiendo:

### FASE 1 — Comprensión

Audita todos los usos actuales.

### FASE 2 — Análisis

Clasifica cada uso:

* éxito;
* error;
* warning;
* información;
* confirmación;
* destructivo.

### FASE 3 — Diseño

Define el sistema UI reutilizable más adecuado según la arquitectura existente.

### FASE 4 — Implementación

Reemplaza los usos manteniendo la lógica actual.

### FASE 5 — Verificación

Ejecuta búsquedas, builds y pruebas funcionales.

### FASE 6 — Informe

Indica:

* cuántos `alert/confirm/prompt` encontraste;
* cuántos reemplazaste;
* qué componentes reutilizaste/creaste;
* qué páginas fueron modificadas;
* qué pruebas ejecutaste;
* resultado de tsc/eslint/build;
* si quedó algún uso nativo y por qué.

## COMIENZA

Primero audita completamente el proyecto.

Después implementa la solución.

No me pidas confirmación para cada alerta individual: una vez comprendida la arquitectura existente, aplica el patrón de forma consistente en todo el proyecto.

No modifiques datos ni schema.

Al terminar, entrega el informe de la Etapa 11 y detente.
