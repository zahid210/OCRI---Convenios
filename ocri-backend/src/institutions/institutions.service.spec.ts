import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InstitutionsService } from './institutions.service';
import { PrismaService } from '../prisma/prisma.service';
import { VIEWER_VISIBLE_STATUSES } from '../common/visibility';

/**
 * El detalle de institución anida sus convenios. Estos tests fijan que un rol
 * restringido (viewer) solo recibe los estados formalizados y no una ventana a
 * las etapas internas (Fase 4 · H4.2, cierre del confinamiento de la Fase 2).
 */
describe('InstitutionsService.findOne', () => {
  let service: InstitutionsService;

  const prisma = {
    institutions: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InstitutionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(InstitutionsService);
  });

  /** `where` de la relación `agreements` pasado a `findUnique`. */
  type AgreementsWhere = { process_status?: { in: string[] } };
  type FindUniqueArg = {
    include?: { agreements?: { where?: AgreementsWhere } };
  };

  const agreementsWhere = (): AgreementsWhere | undefined => {
    const calls = prisma.institutions.findUnique.mock.calls as Array<
      [FindUniqueArg]
    >;
    return calls[0]?.[0].include?.agreements?.where;
  };

  it('filtra los convenios anidados para el rol viewer', async () => {
    prisma.institutions.findUnique.mockResolvedValue({ id: 1, agreements: [] });

    await service.findOne(1, 'viewer');

    const where = agreementsWhere();
    expect(where?.process_status?.in?.slice().sort()).toEqual(
      [...VIEWER_VISIBLE_STATUSES].sort(),
    );
  });

  it('no aplica filtro de estado a los roles de operación', async () => {
    prisma.institutions.findUnique.mockResolvedValue({ id: 1, agreements: [] });

    await service.findOne(1, 'admin');

    expect(agreementsWhere()).toBeUndefined();
  });

  it('responde 404 si la institución no existe', async () => {
    prisma.institutions.findUnique.mockResolvedValue(null);

    await expect(service.findOne(99, 'admin')).rejects.toThrow(
      NotFoundException,
    );
  });
});
