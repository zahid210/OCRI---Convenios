import { ValidationPipe } from '@nestjs/common';
import { RequestReportDto } from './request-report.dto';
import { EvaluateDeliverableDto } from './evaluate-deliverable.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function validateWithPipe(
  metatype: unknown,
  data: unknown,
): Promise<{ ok: boolean }> {
  try {
    await pipe.transform(data, { type: 'body', metatype });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

describe('deliverables DTOs (validación)', () => {
  describe('RequestReportDto', () => {
    it('acepta tipos válidos', async () => {
      const a = await validateWithPipe(RequestReportDto, {
        type: 'INFORME_SEMESTRAL',
      });
      const b = await validateWithPipe(RequestReportDto, {
        type: 'INFORME_FINAL',
      });
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
    });

    it('rechaza un tipo inexistente', async () => {
      const { ok } = await validateWithPipe(RequestReportDto, {
        type: 'INFORME_TRIMESTRAL',
      });
      expect(ok).toBe(false);
    });
  });

  describe('EvaluateDeliverableDto', () => {
    it('acepta APPROVED y OBSERVED', async () => {
      const a = await validateWithPipe(EvaluateDeliverableDto, {
        decision: 'APPROVED',
      });
      const b = await validateWithPipe(EvaluateDeliverableDto, {
        decision: 'OBSERVED',
        observations: 'corregir',
      });
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
    });

    it('rechaza decisiones desconocidas', async () => {
      const { ok } = await validateWithPipe(EvaluateDeliverableDto, {
        decision: 'REVISAR',
      });
      expect(ok).toBe(false);
    });
  });
});
