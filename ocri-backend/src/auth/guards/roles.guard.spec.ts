import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CREATOR_ROLES, FLOW_ROLES } from '../role-sets';

// El guard es una lista blanca pura: si el rol del usuario está en el array de
// `@Roles()` pasa, y si no, 403. Estos tests fijan esa matriz para que ampliar
// permisos sea un cambio deliberado. Antes de existirlos, un cambio en
// role-sets.ts no rompía ningún test: la autorización no estaba cubierta.
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  // Controladores con la misma metadata que los reales, para ejercitar el guard
  // sin levantar la aplicación ni tocar la base de datos.
  @Roles(...CREATOR_ROLES)
  class SoloCreacion {
    crear() {}
  }

  @Roles(...FLOW_ROLES)
  class SoloFlujo {
    avanzar() {}
  }

  @Roles('admin')
  class SoloAdmin {
    borrar() {}
  }

  class SinRestriccion {
    leer() {}
  }

  type ControllerClass = new (...args: never[]) => object;

  const ctxFor = (target: ControllerClass, role?: string): ExecutionContext =>
    ({
      getHandler: (): unknown => target.prototype,
      getClass: (): unknown => target,
      switchToHttp: () => ({
        getRequest: (): unknown => (role ? { user: { role } } : {}),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('deja pasar a los roles de CREATOR_ROLES y bloquea al resto', () => {
    for (const role of ['admin', 'asistente', 'procesador']) {
      expect(guard.canActivate(ctxFor(SoloCreacion, role))).toBe(true);
    }
    expect(() => guard.canActivate(ctxFor(SoloCreacion, 'viewer'))).toThrow(
      ForbiddenException,
    );
  });

  it('deja pasar a los roles de FLOW_ROLES y bloquea al asistente', () => {
    expect(guard.canActivate(ctxFor(SoloFlujo, 'admin'))).toBe(true);
    expect(guard.canActivate(ctxFor(SoloFlujo, 'procesador'))).toBe(true);
    // El asistente registra propuestas pero no avanza el flujo.
    expect(() => guard.canActivate(ctxFor(SoloFlujo, 'asistente'))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(ctxFor(SoloFlujo, 'viewer'))).toThrow(
      ForbiddenException,
    );
  });

  it('no otorga permisos implícitos a admin fuera de su lista explícita', () => {
    expect(guard.canActivate(ctxFor(SoloAdmin, 'admin'))).toBe(true);
    for (const role of ['procesador', 'asistente', 'viewer']) {
      expect(() => guard.canActivate(ctxFor(SoloAdmin, role))).toThrow(
        ForbiddenException,
      );
    }
  });

  it('permite el paso si la ruta no declara @Roles', () => {
    // Endpoints de lectura sin @Roles(): basta con estar autenticado.
    for (const role of ['admin', 'asistente', 'procesador', 'viewer']) {
      expect(guard.canActivate(ctxFor(SinRestriccion, role))).toBe(true);
    }
  });

  it('rechaza cuando la petición no tiene usuario (no autenticado)', () => {
    expect(() => guard.canActivate(ctxFor(SoloCreacion))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(ctxFor(SoloCreacion, undefined))).toThrow(
      ForbiddenException,
    );
  });
});
