Buen trabajo. Antes de continuar con nuevos módulos, quiero realizar una etapa de estabilización y preparación.

Además de los problemas técnicos que ya identificaste, acabo de detectar **errores de Hydration en algunas rutas del frontend**.

Quiero que esta etapa incluya una revisión sistemática de estos problemas en TODO el frontend, no solamente de los casos que te voy a indicar.

No implementes todavía Oficios, Work Plans, agreement_reports ni practicantes/asistencia.

---

# ETAPA 6 — ESTABILIZACIÓN GENERAL DEL SISTEMA

El objetivo de esta etapa es dejar el sistema actual estable antes de comenzar nuevos módulos funcionales.

Debes revisar:

1. Next.js 16 / middleware → proxy.
2. JWT y cambios de rol.
3. Tokens antiguos.
4. Cambios previos sin commitear.
5. Warnings de ESLint.
6. **Hydration errors del frontend.**
7. Verificación completa después de las correcciones.

---

# 1. Next.js 16 — middleware → proxy

Analiza la advertencia relacionada con `middleware.ts` y la recomendación de Next.js 16 de utilizar `proxy.ts`.

Si la migración puede realizarse manteniendo exactamente el comportamiento actual:

* protección de rutas,
* redirección al login,
* redirección de usuarios autenticados,
* cookies,
* rutas de convenios,
* instituciones,
* reportes,
* seguimiento,
* usuarios,

realiza la migración.

No cambies el comportamiento funcional.

Si existe algún riesgo de incompatibilidad, detente y explícame antes de modificarlo.

---

# 2. JWT y cambios de rol

Actualmente el rol queda incluido en el JWT al iniciar sesión.

Quiero que analices si esto debe mantenerse así o si existe una solución compatible con la arquitectura actual para evitar que un cambio de rol requiera obligatoriamente volver a iniciar sesión.

Por ahora:

**NO cambies este comportamiento todavía.**

Solo analiza:

* cómo se genera actualmente el JWT,
* dónde se obtiene el rol,
* cómo lo utiliza RolesGuard,
* qué ocurre cuando un admin cambia el rol de otro usuario,
* qué alternativas existen.

Después dime cuál consideras la solución más coherente.

No implementes una solución nueva de autenticación sin mi aprobación.

---

# 3. Tokens antiguos

Analiza el problema de los tokens emitidos antes de implementar roles.

Determina si realmente es necesario realizar alguna acción o si simplemente desaparecerá cuando las sesiones actuales expiren o los usuarios vuelvan a iniciar sesión.

No fuerces logout masivo ni modifiques tokens existentes.

---

# 4. Cambios previos sin commitear

Recuerda que:

`agreements/[id]/page.tsx`

ya tenía cambios previos de una sesión anterior.

No elimines, reviertas ni sobrescribas esos cambios.

Si necesitas modificar ese archivo para una tarea futura, primero revisa cuidadosamente qué cambios ya existen.

---

# 5. ESLint

Revisa las 5 advertencias preexistentes.

No necesito que las elimines automáticamente.

Determina si alguna está relacionada con código que acabamos de modificar.

Si son completamente preexistentes y no afectan el funcionamiento, déjalas documentadas.

---

# 6. IMPORTANTE — Auditoría de Hydration

Acabo de detectar errores de hidratación en el frontend.

Quiero que realices una **auditoría completa de hydration en todas las rutas y componentes relevantes del frontend**, no solamente de los errores que te muestro a continuación.

El objetivo no es esconder el error ni desactivar la advertencia.

Quiero encontrar y corregir la causa real.

---

## Error detectado 1 — Sidebar / Dashboard

Actualmente aparece:

```text
Recoverable Error

Hydration failed because the server rendered HTML didn't match the client.
As a result this tree will be regenerated on the client.
```

El stack apunta a:

```text
src/components/layout/sidebar.tsx
línea 59

<item.icon className={cn(...)} />
```

Y ocurre dentro de:

```text
Sidebar
↓
DashboardLayout
↓
/dashboard
```

El diff muestra diferencias entre elementos `<a>` e iconos dinámicos.

Debes investigar:

* Cómo se construye el array de navegación.
* Cómo se selecciona `item.icon`.
* Si el resultado del render puede cambiar entre servidor y cliente.
* Si `isActive` tiene un valor diferente durante SSR y durante hidratación.
* Si existe alguna dependencia de `window`, `location`, pathname u otra información exclusivamente del cliente.
* Si el componente está utilizando algún estado inicial diferente entre servidor y cliente.
* Si los iconos de Lucide están siendo renderizados de manera determinista.
* Si existe alguna condición que produzca HTML diferente entre SSR y cliente.
* Si el problema realmente está en `sidebar.tsx` o si el sidebar simplemente es el lugar donde React detecta la diferencia.

No asumas que la línea indicada por el stack es necesariamente la causa.

Encuentra la causa real.

---

# 7. Error detectado 2 — Reports

También aparece:

```text
Console Error

In HTML, whitespace text nodes cannot be a child of <tr>.
Make sure you don't have any extra whitespace between tags on each line of your source code.
```

El stack apunta a:

```text
src/app/(dashboard)/reports/page.tsx
línea 541
```

Dentro de un `<tr>` existen aparentemente espacios/newlines que React está interpretando como nodos de texto.

El fragmento mostrado contiene algo equivalente a:

```tsx
<tr className="border-b border-gray-200">
    <th>
    <th>
    <th>
        {"                                        "}
    ...
</tr>
```

Debes revisar cuidadosamente:

* `<table>`
* `<thead>`
* `<tbody>`
* `<tr>`
* `<th>`
* `<td>`

y asegurarte de que la estructura HTML sea válida.

Especialmente revisa:

* whitespace explícito,
* strings,
* expresiones JSX,
* comentarios,
* condicionales,
* fragments,
* `.map()`,
* elementos condicionales dentro de `<tr>`.

No soluciones simplemente eliminando espacios sin entender de dónde vienen.

La estructura debe producir HTML válido y consistente entre servidor y cliente.

---

# 8. Auditoría completa de hydration

Además de los dos errores anteriores, revisa TODO el frontend buscando causas potenciales de hydration mismatch.

Debes revisar como mínimo:

```text
src/app/
src/components/
src/lib/
src/hooks/
src/context/
middleware / proxy
layouts
headers
sidebars
tables
modals
dropdowns
forms
dashboards
```

Y especialmente todas las rutas actualmente implementadas:

```text
/login
/dashboard
/agreements
/agreements/create
/agreements/[id]
/agreements/[id]/edit
/institutions
/reports
/seguimiento
/users
```

Si existen otras rutas, inclúyelas también.

---

# 9. Patrones que debes buscar

Busca activamente patrones conocidos que puedan provocar hydration mismatch.

Por ejemplo:

### Datos diferentes entre servidor y cliente

* `Date.now()`
* `new Date()`
* `Math.random()`
* IDs generados dinámicamente.
* Valores dependientes de tiempo.
* Valores dependientes de locale.

### Browser APIs durante render

* `window`
* `document`
* `localStorage`
* `sessionStorage`
* `navigator`
* `location`

Especialmente cuando se utilizan directamente durante el render.

### Condiciones servidor/cliente

```tsx
typeof window !== "undefined"
```

cuando producen HTML diferente.

### Estado inicial

* `useState` cuyo valor inicial depende del navegador.
* `useEffect` que provoca un cambio inmediato de estructura.
* Contextos que entregan valores diferentes inicialmente.
* Datos obtenidos únicamente en cliente después del render.

### Routing

* `usePathname`
* `useSearchParams`
* navegación condicional.
* elementos activos del sidebar/header.

### HTML inválido

Especialmente:

```text
table
thead
tbody
tr
th
td
ul
ol
p
button
a
```

Busca nesting incorrecto.

### Renderizado condicional

Revisa:

```tsx
condition && <Component />
condition ? <A /> : <B />
```

cuando la condición pueda ser diferente entre SSR y cliente.

### Componentes dinámicos

Revisa:

* iconos dinámicos,
* componentes cargados dinámicamente,
* componentes que dependen del usuario,
* componentes que dependen de cookies,
* componentes que dependen de pathname.

---

# 10. No ocultar los errores

NO quiero soluciones como:

```tsx
suppressHydrationWarning
```

salvo que exista una razón técnica muy específica y me expliques primero por qué.

Tampoco quiero convertir componentes innecesariamente en:

```tsx
dynamic(..., { ssr: false })
```

solo para hacer desaparecer el error.

No quiero ocultar el problema.

Quiero corregir la causa.

Si un componente realmente debe ser exclusivamente client-side, analiza primero si existe una razón arquitectónica válida y documenta la decisión.

---

# 11. Prioridad de las correcciones

Clasifica los problemas encontrados como:

### P0

Hydration que provoca errores visibles o regeneración del árbol.

### P1

HTML inválido o diferencias que probablemente provoquen hydration.

### P2

Patrones potencialmente peligrosos que todavía no producen un error visible.

### P3

Código que puede mejorarse pero no está relacionado con hydration.

Corrige P0 y P1.

No es necesario realizar un refactor general del frontend.

---

# 12. Verificación específica de hydration

Después de corregir los problemas:

Haz una revisión de las rutas:

```text
/dashboard
/agreements
/agreements/create
/agreements/[id]
/agreements/[id]/edit
/institutions
/reports
/seguimiento
/users
```

Verifica que:

* No aparezca `Hydration failed`.
* No aparezca `hydration mismatch`.
* No aparezca `whitespace text nodes cannot be a child of <tr>`.
* No existan errores de HTML inválido.
* Las rutas sigan funcionando.
* Los elementos activos del sidebar sigan funcionando.
* Los datos del usuario sigan funcionando.
* Las tablas sigan funcionando.
* Los filtros sigan funcionando.
* Los modales sigan funcionando.

Si dispones de una forma segura de ejecutar la aplicación en desarrollo para observar la consola, puedes utilizarla.

No realices acciones destructivas.

---

# 13. Verificación general

Después de esta etapa quiero que vuelvas a ejecutar las verificaciones que sean seguras:

## Backend

* tsc
* eslint
* nest build
* tests existentes relevantes

## Frontend

* tsc
* eslint
* next build

Además de las verificaciones anteriores:

**comprueba específicamente los hydration errors del navegador.**

Un `next build` exitoso NO significa necesariamente que no existan problemas de hydration en runtime.

Por lo tanto, diferencia entre:

* compilación correcta,
* lint correcto,
* hydration correcto en runtime.

---

# 14. Resultado esperado

Cuando termines esta etapa quiero un informe con:

## A. Problemas encontrados

Lista todos los problemas relevantes.

## B. Hydration

Para cada problema:

* Ruta.
* Componente.
* Causa.
* Solución aplicada.
* Por qué la solución corrige la causa.

## C. Problemas técnicos restantes

* ...

## D. Deuda técnica

* ...

## E. Estado actual del proyecto

Resume qué está terminado.

## F. Funcionalidades pendientes

Separadas entre:

* Definidas suficientemente para implementar.
* Requieren reglas de negocio.
* Futuras / fuera del alcance actual.

## G. Próximo paso

NO empieces automáticamente con Oficios.

Primero quiero que me indiques qué información de negocio necesitas para poder implementar correctamente ese módulo.

---

# REGLA IMPORTANTE

No inventes reglas de negocio.

Si detectas en el código una intención clara, puedes explicarla como hipótesis, pero no la conviertas automáticamente en comportamiento.

Las decisiones técnicas menores puedes tomarlas autónomamente.

Las decisiones de negocio importantes debes consultármelas.

Los cambios de schema deben consultarse antes de ejecutarse.

Las operaciones destructivas deben consultarse antes de ejecutarse.

---

# OBJETIVO DE ESTA ETAPA

Quiero que terminemos esta fase con un sistema:

* funcional,
* estable,
* sin hydration errors conocidos,
* sin errores de HTML relacionados,
* con frontend y backend coherentes,
* con autenticación y autorización funcionando,
* y con los módulos actuales correctamente integrados.

Después de eso nos detendremos para definir las reglas de negocio de Oficios.

Comienza ahora con la **Etapa 6 — Estabilización General + Auditoría de Hydration**.
