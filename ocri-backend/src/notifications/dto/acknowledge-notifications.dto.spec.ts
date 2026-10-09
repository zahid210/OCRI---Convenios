import { Type, ValidationPipe } from '@nestjs/common';
import { AcknowledgeNotificationsDto } from './acknowledge-notifications.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function validateWithPipe(
  metatype: Type<unknown>,
  data: unknown,
): Promise<{ ok: boolean; messages: string[] }> {
  try {
    await pipe.transform(data, { type: 'body', metatype });
    return { ok: true, messages: [] };
  } catch (err) {
    const response = (err as { response?: { message?: unknown } }).response;
    const messages = Array.isArray(response?.message)
      ? (response.message as string[])
      : [];
    return { ok: false, messages };
  }
}

describe('AcknowledgeNotificationsDto', () => {
  it('acepta un arreglo de strings', async () => {
    const { ok } = await validateWithPipe(AcknowledgeNotificationsDto, {
      keys: ['n-1', 'n-2'],
    });
    expect(ok).toBe(true);
  });

  it('rechaza keys con números', async () => {
    const { ok, messages } = await validateWithPipe(
      AcknowledgeNotificationsDto,
      {
        keys: [1, 2],
      },
    );
    expect(ok).toBe(false);
    expect(messages.join()).toContain('key');
  });

  it('rechaza keys faltante', async () => {
    const { ok } = await validateWithPipe(AcknowledgeNotificationsDto, {});
    expect(ok).toBe(false);
  });

  it('acepta hasta 200 claves', async () => {
    const keys = Array.from({ length: 200 }, (_, i) => `key-${i}`);
    const { ok } = await validateWithPipe(AcknowledgeNotificationsDto, {
      keys,
    });
    expect(ok).toBe(true);
  });

  it('rechaza arreglos de más de 200 claves (antes llegaban al motor)', async () => {
    const keys = Array.from({ length: 201 }, (_, i) => `key-${i}`);
    const { ok, messages } = await validateWithPipe(
      AcknowledgeNotificationsDto,
      { keys },
    );
    expect(ok).toBe(false);
    expect(messages.join()).toContain('200');
  });

  it('acepta claves de hasta 120 caracteres', async () => {
    const { ok } = await validateWithPipe(AcknowledgeNotificationsDto, {
      keys: ['expiring-' + 'a'.repeat(111)],
    });
    expect(ok).toBe(true);
  });

  it('rechaza claves de más de 120 caracteres (antes se descartaban en silencio)', async () => {
    const { ok, messages } = await validateWithPipe(
      AcknowledgeNotificationsDto,
      {
        keys: ['expiring-' + 'a'.repeat(112)],
      },
    );
    expect(ok).toBe(false);
    expect(messages.join()).toContain('120');
  });
});
