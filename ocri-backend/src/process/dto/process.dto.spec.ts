import { Type, ValidationPipe } from '@nestjs/common';
import { GenerateOpinionRequestsDto } from './generate-opinion-requests.dto';
import { RectorateDecisionDto } from './rectorate-decision.dto';
import { ValidateOpinionRequestDto } from './validate-opinion-request.dto';
import { SetValidityDto } from './set-validity.dto';
import { RegisterAgreementDto } from './register-agreement.dto';
import { GenerateOficioOpinionDto } from './generate-oficio-opinion.dto';

/**
 * Reproduce el ValidationPipe global de main.ts para verificar el
 * comportamiento completo (whitelist + forbidNonWhitelisted + transform).
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function validateWithPipe(
  metatype: Type<unknown>,
  data: unknown,
): Promise<{ ok: boolean; value?: unknown; messages: string[] }> {
  try {
    const value: unknown = await pipe.transform(data, {
      type: 'body',
      metatype,
    });
    return { ok: true, value, messages: [] };
  } catch (err) {
    const response = (err as { response?: { message?: unknown } }).response;
    const messages = Array.isArray(response?.message)
      ? (response.message as string[])
      : [String(response?.message ?? err)];
    return { ok: false, messages };
  }
}

describe('process DTOs (validación)', () => {
  describe('GenerateOpinionRequestsDto', () => {
    it('acepta payload válido', async () => {
      const { ok, value } = await validateWithPipe(GenerateOpinionRequestsDto, {
        dependencia_ids: [1, 2, 3],
        default_days: 15,
      });
      expect(ok).toBe(true);
      expect((value as { dependencia_ids: number[] }).dependencia_ids).toEqual([
        1, 2, 3,
      ]);
    });

    it('rechaza dependencia_ids faltante', async () => {
      const { ok, messages } = await validateWithPipe(
        GenerateOpinionRequestsDto,
        {},
      );
      expect(ok).toBe(false);
      expect(messages.join()).toContain('dependencia_ids');
    });

    it('rechaza elementos no numéricos', async () => {
      const { ok, messages } = await validateWithPipe(
        GenerateOpinionRequestsDto,
        {
          dependencia_ids: [1, 'x'],
        },
      );
      expect(ok).toBe(false);
      expect(messages.join()).toContain('dependencia_id');
    });

    it('rechaza default_days fuera de rango', async () => {
      const zero = await validateWithPipe(GenerateOpinionRequestsDto, {
        dependencia_ids: [1],
        default_days: 0,
      });
      expect(zero.ok).toBe(false);

      const huge = await validateWithPipe(GenerateOpinionRequestsDto, {
        dependencia_ids: [1],
        default_days: 400,
      });
      expect(huge.ok).toBe(false);
    });
  });

  describe('RectorateDecisionDto', () => {
    it('acepta APPROVED', async () => {
      const { ok } = await validateWithPipe(RectorateDecisionDto, {
        decision: 'APPROVED',
      });
      expect(ok).toBe(true);
    });

    it('rechaza una decisión desconocida', async () => {
      const { ok } = await validateWithPipe(RectorateDecisionDto, {
        decision: 'TAL_VEZ',
      });
      expect(ok).toBe(false);
    });
  });

  describe('ValidateOpinionRequestDto', () => {
    it('acepta booleano JSON', async () => {
      const { ok } = await validateWithPipe(ValidateOpinionRequestDto, {
        valid: true,
      });
      expect(ok).toBe(true);
    });

    it('acepta "true" como string (multipart)', async () => {
      const { ok, value } = await validateWithPipe(ValidateOpinionRequestDto, {
        valid: 'true',
      });
      expect(ok).toBe(true);
      expect((value as { valid: boolean }).valid).toBe(true);
    });

    it('rechaza valores que no son booleanos válidos', async () => {
      const { ok } = await validateWithPipe(ValidateOpinionRequestDto, {
        valid: 'quizas',
      });
      expect(ok).toBe(false);
    });
  });

  describe('SetValidityDto', () => {
    it('acepta VIGENTE', async () => {
      const { ok } = await validateWithPipe(SetValidityDto, {
        validity: 'VIGENTE',
      });
      expect(ok).toBe(true);
    });

    it('rechaza valores fuera del conjunto', async () => {
      const { ok, messages } = await validateWithPipe(SetValidityDto, {
        validity: 'ROTO',
      });
      expect(ok).toBe(false);
      expect(messages.join()).toContain('VIGENTE');
    });
  });

  describe('RegisterAgreementDto', () => {
    it('acepta responsables como string JSON (multipart)', async () => {
      const { ok, value } = await validateWithPipe(RegisterAgreementDto, {
        resolution_number: 'R-1',
        responsables: '[{"name":"Pepe","side":"UNCP"}]',
      });
      expect(ok).toBe(true);
      expect((value as { responsables: unknown[] }).responsables).toHaveLength(
        1,
      );
    });

    it('acepta responsables como arreglo JSON', async () => {
      const { ok } = await validateWithPipe(RegisterAgreementDto, {
        resolution_number: 'R-1',
        responsables: [{ name: 'Pepe' }, { name: 'Ana', side: 'CONTRAPARTE' }],
      });
      expect(ok).toBe(true);
    });

    it('rechaza un responsable sin nombre', async () => {
      const { ok, messages } = await validateWithPipe(RegisterAgreementDto, {
        responsables: '[{"role":"Coordinador"}]',
      });
      expect(ok).toBe(false);
      expect(messages.join()).toContain('name');
    });

    it('rechaza un side inválido', async () => {
      const { ok, messages } = await validateWithPipe(RegisterAgreementDto, {
        responsables: [{ name: 'Pepe', side: 'OTRO' }],
      });
      expect(ok).toBe(false);
      expect(messages.join()).toContain('side');
    });

    it('rechaza fecha de vigencia con formato inválido', async () => {
      const { ok, messages } = await validateWithPipe(RegisterAgreementDto, {
        start_date: 'no-es-fecha',
      });
      expect(ok).toBe(false);
      expect(messages.join()).toContain('start_date');
    });

    it('rechaza campos no declarados', async () => {
      const { ok } = await validateWithPipe(RegisterAgreementDto, {
        resolution_number: 'R-1',
        campo_extra: 'x',
      });
      expect(ok).toBe(false);
    });
  });

  describe('GenerateOficioOpinionDto', () => {
    it('acepta bodyHtml', async () => {
      const { ok } = await validateWithPipe(GenerateOficioOpinionDto, {
        bodyHtml: '<p>Oficio</p>',
      });
      expect(ok).toBe(true);
    });

    it('rechaza bodyHtml faltante', async () => {
      const { ok } = await validateWithPipe(GenerateOficioOpinionDto, {});
      expect(ok).toBe(false);
    });
  });
});
