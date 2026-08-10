# Auditoría y comprensión integral del proyecto NestJS + Next.js

## Contexto

Estoy desarrollando actualmente un sistema utilizando:

- **Backend:** NestJS
- **Frontend:** Next.js
- El proyecto se encuentra **en desarrollo y todavía no está terminado**.
- Quiero que primero comprendas completamente lo que estoy construyendo antes de que posteriormente te pida implementar, corregir o completar funcionalidades.

Tu tarea en esta etapa es **EXCLUSIVAMENTE leer, inspeccionar, analizar y comprender el proyecto existente**.

---

# 🚨 REGLA ABSOLUTA: NO MODIFICAR NADA

Durante toda esta tarea:

- **NO modifiques ningún archivo.**
- **NO crees archivos.**
- **NO elimines archivos.**
- **NO renombres archivos.**
- **NO muevas archivos.**
- **NO ejecutes comandos que puedan modificar el proyecto.**
- **NO instales dependencias.**
- **NO actualices dependencias.**
- **NO ejecutes migraciones.**
- **NO ejecutes comandos de generación de código.**
- **NO hagas commits.**
- **NO hagas cambios de configuración.**
- **NO formatees archivos automáticamente.**
- **NO corrijas errores aunque los encuentres.**
- **NO intentes "mejorar" el código.**
- **NO implementes funcionalidades faltantes.**

Quiero únicamente una **auditoría de lectura y comprensión**.

Puedes utilizar comandos de lectura, búsqueda, inspección y análisis que sean necesarios, siempre que no modifiquen ningún archivo ni el estado del proyecto.

Si encuentras algo que normalmente requeriría ejecutar una acción potencialmente modificadora, **no la ejecutes**. Simplemente indícalo en el informe.

---

# Objetivo principal

Quiero que actúes como un **arquitecto de software que acaba de incorporarse al proyecto**.

Tu objetivo es responder:

> "Si otro desarrollador te entregara este repositorio y te pidiera continuar el desarrollo, ¿qué entenderías que está construyendo, cómo está estructurado, cómo funciona y qué partes faltan?"

No quiero únicamente una descripción superficial de carpetas.

Necesito que explores el proyecto suficientemente para entender:

- Qué problema intenta resolver.
- Qué tipo de sistema es.
- Quiénes son sus usuarios.
- Qué funcionalidades parecen existir.
- Qué funcionalidades están en desarrollo.
- Cómo se relacionan frontend y backend.
- Cómo está organizada la arquitectura.
- Cómo fluye la información.
- Qué entidades o conceptos principales existen.
- Cómo se comunican los diferentes módulos.
- Qué decisiones arquitectónicas parecen haberse tomado.
- Qué partes están terminadas.
- Qué partes están incompletas.
- Qué partes parecen preparadas para implementarse posteriormente.
- Qué dudas o ambigüedades existen.

---

# 1. Inspección inicial del repositorio

Comienza explorando la estructura general del proyecto.

Identifica:

- Directorios principales.
- Aplicaciones existentes.
- Backend.
- Frontend.
- Librerías compartidas, si existen.
- Configuraciones.
- Scripts.
- Archivos de entorno y ejemplos de entorno.
- Configuración de TypeScript.
- Configuración de NestJS.
- Configuración de Next.js.
- ORM utilizado.
- Base de datos utilizada o prevista.
- Sistema de autenticación.
- Sistema de autorización.
- Dependencias relevantes.
- Herramientas adicionales.

Determina si se trata de:

- Monorepo.
- Repositorios separados.
- Arquitectura modular.
- Aplicación monolítica.
- Backend y frontend independientes.
- Alguna combinación de las anteriores.

No asumas la arquitectura únicamente por los nombres de las carpetas. Confírmala leyendo el código.

---

# 2. Analiza el Backend

Inspecciona profundamente el proyecto NestJS.

Identifica:

## Arquitectura

- Módulos.
- Controllers.
- Services.
- Providers.
- Guards.
- Interceptors.
- Pipes.
- Decorators.
- Middleware.
- Filters.
- DTOs.
- Entities.
- Repositories.
- Use cases.
- Casos de dominio.
- Servicios externos.
- Configuración.

Determina qué patrón arquitectónico parece utilizar el proyecto.

Por ejemplo, si corresponde:

- Modular Architecture.
- Layered Architecture.
- Clean Architecture.
- Hexagonal Architecture.
- DDD.
- CQRS.
- Repository Pattern.
- Alguna combinación.

No etiquetes una arquitectura simplemente porque existan carpetas con esos nombres. Explica por qué llegas a esa conclusión.

---

# 3. Analiza la API

Identifica los endpoints existentes.

Para cada área funcional importante intenta comprender:

- Qué endpoints existen.
- Qué método HTTP utilizan.
- Qué datos reciben.
- Qué datos devuelven.
- Qué servicio procesa la solicitud.
- Qué entidades intervienen.
- Qué reglas de negocio parecen existir.
- Qué validaciones existen.
- Qué autenticación requieren.
- Qué autorización requieren.
- Cómo se manejan los errores.

No necesitas listar absolutamente cada endpoint si el proyecto es grande.

Prioriza los endpoints que sean importantes para entender el funcionamiento general del sistema.

---

# 4. Analiza autenticación y autorización

Investiga cómo funciona la seguridad.

Determina:

- Cómo se autentican los usuarios.
- Si utiliza JWT.
- Cookies.
- Sessions.
- Refresh tokens.
- Access tokens.
- OAuth.
- Algún proveedor externo.
- Guards.
- Roles.
- Permissions.
- Policies.
- Claims.
- Middleware.

Explica el flujo completo que puedas inferir.

Por ejemplo:

```text
Usuario
   ↓
Login
   ↓
Backend
   ↓
Validación
   ↓
Token / sesión
   ↓
Frontend
   ↓
Solicitud autenticada
   ↓
Guard
   ↓
Controller
   ↓
Service
```

Adapta el diagrama a lo que realmente exista en el proyecto.

No inventes comportamientos que no puedas comprobar.

---

# 5. Analiza la base de datos

Identifica:

- Motor de base de datos.
- ORM.
- Schema.
- Entidades.
- Modelos.
- Relaciones.
- Claves primarias.
- Claves foráneas.
- Relaciones 1:1.
- Relaciones 1:N.
- Relaciones N:M.
- Enums.
- Índices relevantes.
- Soft delete, si existe.
- Auditoría, si existe.
- Migraciones.
- Seeds.

Intenta construir una representación conceptual de la base de datos.

Por ejemplo:

```text
Usuario
 ├── tiene muchos pedidos
 ├── pertenece a una organización
 └── posee determinados permisos

Pedido
 ├── pertenece a un usuario
 ├── contiene productos
 └── tiene un estado
```

Utiliza únicamente relaciones que puedas deducir del código.

---

# 6. Analiza el Frontend

Inspecciona profundamente la aplicación Next.js.

Identifica:

- App Router o Pages Router.
- Páginas.
- Layouts.
- Routes.
- Server Components.
- Client Components.
- Hooks.
- Contexts.
- Providers.
- State management.
- Formularios.
- Validaciones.
- Componentes reutilizables.
- UI.
- Servicios.
- API clients.
- Fetch/Axios u otras herramientas.
- Manejo de errores.
- Loading states.
- Manejo de autenticación.
- Protección de rutas.
- Middleware.
- Manejo de sesiones.
- Variables de entorno.

Determina cómo está organizada la aplicación frontend y cuál parece ser la responsabilidad de cada área.

---

# 7. Analiza la comunicación Frontend ↔ Backend

Esta parte es especialmente importante.

Quiero entender cómo se comunica Next.js con NestJS.

Investiga:

- URLs de la API.
- Configuración de endpoints.
- Clientes HTTP.
- Fetch.
- Axios.
- Server Actions.
- API Routes.
- RPC u otros mecanismos.
- Headers.
- Cookies.
- Tokens.
- Interceptors.
- Serialización.
- DTOs compartidos.
- Tipos compartidos.
- Manejo de errores.

Describe el flujo de una operación representativa.

Por ejemplo:

```text
Usuario interactúa con UI
        ↓
Componente Next.js
        ↓
Hook / Service / Action
        ↓
HTTP Request
        ↓
NestJS Controller
        ↓
DTO / Validation
        ↓
Service
        ↓
Repository / ORM
        ↓
Database
        ↓
Response
        ↓
Frontend
        ↓
UI
```

Pero utiliza el flujo real del proyecto, no este ejemplo si no corresponde.

---

# 8. Identifica las funcionalidades del sistema

A partir del código intenta determinar qué funcionalidades está construyendo el proyecto.

Agrúpalas por módulos o áreas funcionales.

Por ejemplo:

```text
Autenticación
- Login
- Registro
- Recuperación de contraseña

Usuarios
- Crear usuario
- Editar usuario
- Consultar usuario

Productos
- Crear producto
- Editar producto
- Listar productos

Reportes
- ...
```

Estos son únicamente ejemplos.

Debes identificar las funcionalidades reales del proyecto.

Diferencia entre:

### Implementado

Funcionalidad que claramente existe y tiene implementación.

### Parcialmente implementado

Existe código relacionado, pero parece incompleto.

### Preparado

Existe estructura o intención clara, pero falta implementación.

### No implementado / desconocido

No existe evidencia suficiente de que esté implementado.

No asumas que algo está pendiente simplemente porque no encontraste una implementación rápidamente.

---

# 9. Analiza el dominio del sistema

Esta es una de las partes más importantes.

Intenta responder:

### ¿Qué sistema estoy construyendo?

Explícalo utilizando lenguaje de negocio, no únicamente lenguaje técnico.

Por ejemplo, no quiero solamente:

> "Es una aplicación Next.js con NestJS y PostgreSQL."

Quiero algo parecido a:

> "Parece ser un sistema destinado a gestionar X, donde los usuarios pueden realizar Y y los administradores pueden hacer Z. El backend centraliza las reglas de negocio relacionadas con..., mientras que el frontend proporciona..."

La explicación debe estar basada en el código real.

Si no puedes determinar algo con suficiente certeza, dilo explícitamente.

---

# 10. Identifica actores y usuarios

Determina qué tipos de usuarios existen.

Por ejemplo:

- Administrador.
- Usuario normal.
- Operador.
- Cliente.
- Supervisor.
- etc.

Para cada uno, intenta determinar:

- Qué puede hacer.
- Qué información puede consultar.
- Qué operaciones puede realizar.
- Qué permisos parece tener.

Si los roles no están claramente definidos, indícalo.

---

# 11. Identifica los flujos principales

Intenta reconstruir los principales flujos de negocio.

Por ejemplo:

```text
Registro
Usuario → Frontend → Backend → Base de datos

Autenticación
Usuario → Login → Backend → Token → Frontend

Creación de recurso
Usuario → Formulario → API → Service → Database

Consulta
Frontend → API → Service → Repository → Database → Frontend
```

Identifica los flujos reales más importantes del sistema.

---

# 12. Busca TODO lo que indique trabajo incompleto

Inspecciona el proyecto buscando señales de funcionalidades pendientes.

Por ejemplo:

- TODO.
- FIXME.
- HACK.
- Comentarios de implementación futura.
- Métodos vacíos.
- Funciones incompletas.
- `throw new Error(...)`.
- `NotImplemented`.
- Placeholders.
- Datos mock.
- Datos hardcodeados.
- Componentes temporales.
- Endpoints sin consumir.
- Servicios sin utilizar.
- Código comentado.
- Imports sin utilizar.
- Tipos provisionales.
- Variables de entorno faltantes.
- Funcionalidades mencionadas pero no implementadas.
- Pantallas sin conexión al backend.
- Backend implementado pero sin frontend.
- Frontend preparado pero sin endpoint correspondiente.

No corrijas nada.

Solo identifica y clasifica lo encontrado.

---

# 13. Identifica inconsistencias

Busca posibles inconsistencias entre frontend y backend.

Por ejemplo:

- DTO diferente al tipo utilizado en frontend.
- Endpoint esperado pero inexistente.
- Endpoint existente pero no utilizado.
- Nombres diferentes.
- Campos diferentes.
- Tipos incompatibles.
- Estados diferentes.
- Reglas de validación diferentes.
- Manejo de errores inconsistente.
- Autenticación implementada de una forma pero consumida de otra.
- Funcionalidades parcialmente conectadas.

No corrijas estas inconsistencias.

Solo documenta:

1. Qué encontraste.
2. Dónde lo encontraste.
3. Por qué parece inconsistente.
4. Qué impacto podría tener.

---

# 14. Evalúa el estado actual

Realiza una evaluación general del proyecto.

Clasifica aproximadamente cada área como:

- 🟢 Bien definido / implementado.
- 🟡 Parcial / en desarrollo.
- 🔴 Incompleto / problemático.
- ⚪ No determinable.

Evalúa como mínimo:

- Arquitectura.
- Backend.
- API.
- Base de datos.
- Autenticación.
- Autorización.
- Frontend.
- Comunicación frontend/backend.
- Validaciones.
- Manejo de errores.
- Testing.
- Configuración.
- Documentación.
- Deployment, si existe.

No necesitas asignar una puntuación numérica si no aporta valor.

---

# 15. Detecta riesgos técnicos

Identifica posibles riesgos que puedan afectar el desarrollo futuro.

Por ejemplo:

- Acoplamiento excesivo.
- Código duplicado.
- Arquitectura inconsistente.
- Dependencias fuertes entre módulos.
- Falta de separación de responsabilidades.
- Inconsistencias frontend/backend.
- Falta de validaciones.
- Problemas potenciales de autenticación.
- Problemas potenciales de autorización.
- Falta de tests.
- Configuración difícil de mantener.
- Código provisional.
- Deuda técnica.

Importante:

**No conviertas esta sección en una auditoría de seguridad exhaustiva ni intentes corregir nada.**

Solo quiero conocer riesgos relevantes para poder continuar desarrollando el proyecto.

---

# 16. No inventes información

Esta regla es muy importante.

Cuando no puedas determinar algo a partir del código:

- No inventes.
- No supongas.
- No presentes hipótesis como hechos.

Utiliza etiquetas como:

- `Confirmado`
- `Probable`
- `Inferido`
- `No determinable`

Por ejemplo:

> **Autenticación:** Confirmado que utiliza JWT.

o:

> **Propósito del módulo X:** Probablemente está destinado a gestionar..., pero no existe suficiente implementación para confirmarlo.

Quiero que diferencies claramente entre lo que sabes y lo que estás infiriendo.

---

# 17. Prioriza comprensión sobre cantidad

No quiero un inventario interminable de archivos.

No es necesario describir cada archivo individualmente.

Quiero que construyas una comprensión de alto nivel y después profundices en las partes importantes.

Prioridad:

1. Propósito del sistema.
2. Dominio.
3. Usuarios.
4. Funcionalidades.
5. Arquitectura.
6. Backend.
7. Frontend.
8. Base de datos.
9. Comunicación entre aplicaciones.
10. Flujos principales.
11. Estado actual.
12. Trabajo pendiente.
13. Riesgos.
14. Dudas.

---

# 18. Informe final obligatorio

Cuando hayas terminado la inspección, genera un informe estructurado con exactamente este enfoque:

## 1. Resumen ejecutivo

Explica en pocas secciones:

- Qué es el proyecto.
- Qué problema intenta resolver.
- Quién lo utiliza.
- Qué funcionalidades principales tiene.
- En qué estado parece encontrarse.

---

## 2. ¿Qué entendí que estás construyendo?

Esta debe ser una de las secciones más importantes.

Explícalo como si estuvieras contándoselo al propio desarrollador del proyecto.

Debe responder:

> "Después de leer el código, ¿qué entiendo que estás intentando construir?"

Utiliza lenguaje funcional/de negocio y no solamente lenguaje técnico.

---

## 3. Arquitectura general

Incluye un diagrama conceptual como:

```text
                 ┌─────────────────┐
                 │     Usuario     │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │    Next.js      │
                 │    Frontend     │
                 └────────┬────────┘
                          │
                       HTTP/API
                          │
                          ▼
                 ┌─────────────────┐
                 │     NestJS      │
                 │     Backend     │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │    Database     │
                 └─────────────────┘
```

Adapta el diagrama a la arquitectura real.

---

## 4. Estructura del proyecto

Explica las partes principales del repositorio y qué responsabilidad tiene cada una.

---

## 5. Backend

Explica:

- Módulos.
- Responsabilidades.
- Controllers.
- Services.
- DTOs.
- Entidades.
- Persistencia.
- Reglas de negocio.
- Seguridad.
- API.

---

## 6. Frontend

Explica:

- Estructura.
- Páginas.
- Componentes.
- Estado.
- Hooks.
- Servicios.
- Autenticación.
- Comunicación con API.
- Principales pantallas o funcionalidades.

---

## 7. Modelo de datos

Explica las entidades principales y sus relaciones.

Incluye un diagrama conceptual si es posible.

---

## 8. Funcionalidades

Tabla recomendada:

| Funcionalidad | Estado | Evidencia | Observaciones |
|---|---|---|---|
| ... | 🟢/🟡/🔴 | archivo/módulo | ... |

---

## 9. Flujos principales

Describe los principales flujos del sistema de extremo a extremo.

---

## 10. Pendientes detectados

Lista las funcionalidades o partes que parecen incompletas.

Sepáralas en:

### Backend

### Frontend

### Integración

### Base de datos

### Infraestructura / configuración

---

## 11. Inconsistencias encontradas

Documenta posibles diferencias o problemas entre las diferentes partes del sistema.

---

## 12. Riesgos técnicos

Lista los riesgos relevantes para continuar el desarrollo.

---

## 13. Decisiones arquitectónicas detectadas

Explica qué decisiones importantes parece haber tomado el proyecto y qué evidencia encontraste.

---

## 14. Dudas que todavía tengo

Esta sección es fundamental.

Después de analizar el proyecto, enumera las cosas que **no puedes determinar con certeza**.

Por ejemplo:

- Propósito de determinado módulo.
- Flujo de determinado proceso.
- Regla de negocio.
- Significado de una entidad.
- Funcionalidad que parece preparada pero no implementada.

No inventes respuestas.

---

## 15. Mapa mental del proyecto

Finaliza creando una representación compacta de todo lo que entendiste.

Por ejemplo:

```text
SISTEMA
│
├── Usuarios
│   ├── Autenticación
│   ├── Roles
│   └── Permisos
│
├── Módulo A
│   ├── ...
│   └── ...
│
├── Módulo B
│   ├── ...
│   └── ...
│
├── Frontend
│   ├── ...
│   └── ...
│
└── Backend
    ├── ...
    └── ...
```

Adáptalo completamente al proyecto real.

---

# 19. Conclusión

Termina respondiendo claramente estas preguntas:

### ¿Qué creo que estás construyendo?

### ¿Cómo creo que funciona?

### ¿Qué partes ya están construidas?

### ¿Qué partes parecen estar en desarrollo?

### ¿Qué partes faltan?

### ¿Qué necesitaría saber del negocio para poder ayudarte correctamente después?

### ¿Qué debería preguntarte antes de implementar nuevas funcionalidades?

---

# Regla final

Recuerda:

**En esta ejecución NO quiero que programes.**

Quiero que primero conozcas el proyecto.

Piensa como un desarrollador senior que acaba de incorporarse a un proyecto existente y necesita comprenderlo antes de tocar una sola línea de código.

Puedes leer todo el código que necesites.

Puedes inspeccionar y relacionar archivos.

Puedes buscar referencias entre frontend y backend.

Puedes reconstruir flujos.

Puedes analizar arquitectura.

Pero:

> **NO MODIFIQUES ABSOLUTAMENTE NADA DEL PROYECTO.**

Al finalizar, entrega únicamente el informe de comprensión y análisis.

Después de este análisis, yo te indicaré qué parte quiero que implementemos o terminemos.