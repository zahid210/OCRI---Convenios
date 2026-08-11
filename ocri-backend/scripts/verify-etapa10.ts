import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { AgreementsService } from '../src/agreements/agreements.service';
import { SeguimientoService } from '../src/seguimiento/seguimiento.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { FINAL_DOCUMENT_NAME } from '../src/agreements/final-document.constants';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  filename?: string;
}

function fakeFile(name: string): MulterFile {
  return {
    fieldname: 'document',
    originalname: name,
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 100,
    filename: name,
  };
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();

  const agreementsService = new AgreementsService(prisma);
  const seguimientoService = new SeguimientoService(prisma);
  const notificationsService = new NotificationsService(prisma);

  const results: string[] = [];
  let testAgreementId: number | null = null;

  const check = (label: string, cond: boolean, detail?: unknown) => {
    results.push(
      `${cond ? 'PASS' : 'FAIL'} | ${label}${
        detail !== undefined ? ` | ${JSON.stringify(detail)}` : ''
      }`,
    );
  };

  const findRow = async (id: number) => {
    const res = await seguimientoService.findAll({});
    return res.data.find((r) => r.id === id);
  };

  const hasPendingAreaInDb = async (
    agreementId: number,
  ): Promise<boolean> => {
    const a = await prisma.agreements.findUnique({
      where: { id: BigInt(agreementId) },
      select: {
        documents: { select: { name: true } },
        roadmap_items: {
          select: {
            is_completed: true,
            roadmap_documents: { select: { type: true } },
          },
        },
      },
    });
    if (!a) return false;
    const finalExists = (a.documents ?? []).some(
      (d) => d.name === FINAL_DOCUMENT_NAME,
    );
    if (finalExists) return false;
    const pendientes = (a.roadmap_items ?? []).filter(
      (item) =>
        !item.is_completed &&
        !(
          item.roadmap_documents.some((d) => d.type === 'entrada') &&
          item.roadmap_documents.some((d) => d.type === 'salida')
        ),
    );
    return pendientes.length > 0;
  };

  try {
    const institution = await prisma.institutions.findFirst();
    const type = await prisma.agreement_types.findFirst();
    if (!institution || !type) {
      throw new Error('No hay instituciones o tipos de convenio en la BD');
    }
    const suffix = Date.now();

    /* ============ CASO A: convenio nuevo SIN documento final ============ */
    const created: any = await agreementsService.create({
      title: `AAAAA-PRUEBA-ETAPA10-A-${suffix}`,
      resolution_number: `TEST-A-${suffix}`,
      institution_id: Number(institution.id),
      agreement_type_id: Number(type.id),
    });
    testAgreementId = Number(created.id);
    const items = created.roadmap_items ?? [];

    check(
      'A1 create: status=En Proceso',
      created.status === 'En Proceso',
      created.status,
    );
    check(
      'A2 create: final_document_exists=false',
      created.final_document_exists === false,
      created.final_document_exists,
    );
    check('A3 create: 4 Ã¡reas de hoja de ruta', items.length === 4, items.length);
    check(
      'A4 create: áreas is_completed=false',
      items.every((i: any) => i.is_completed === false),
    );

    const rowBefore = await findRow(Number(created.id));
    check('B1 seguimiento: progreso=0', rowBefore?.progreso === 0, rowBefore?.progreso);
    check(
      'B2 seguimiento: 4 Ã¡reas opinion_validada=false',
      (rowBefore?.areas ?? []).every((a) => a.opinion_validada === false),
    );
    check(
      'B3 seguimiento: docs_faltantes=4',
      rowBefore?.docs_faltantes === 4,
      rowBefore?.docs_faltantes,
    );
    check(
      'B4 seguimiento: pendiente_completar=true',
      rowBefore?.pendiente_completar === true,
      rowBefore?.pendiente_completar,
    );
    check(
      'B5 seguimiento: final_document_exists=false',
      rowBefore?.final_document_exists === false,
      rowBefore?.final_document_exists,
    );
    check(
      'B6 seguimiento: opiniones_validadas=false',
      rowBefore?.opiniones_validadas === false,
      rowBefore?.opiniones_validadas,
    );
    check(
      'C1 notificaciones (lÃ³gica): pendiente=true',
      (await hasPendingAreaInDb(Number(created.id))) === true,
    );

    /* ============ CASO D: documentos de entrada/salida de un Ã¡rea ============ */
    const item0 = items[0];
    await agreementsService.uploadRoadmapDocument(
      Number(item0.id),
      fakeFile('entrada-0.pdf'),
      'entrada',
    );
    const rowEntrada = await findRow(Number(created.id));
    const area0 = rowEntrada?.areas.find((a) => a.area_name === item0.area_name);
    check(
      'D1 solo entrada: opinion_validada=false (Ã¡rea 1)',
      area0?.opinion_validada === false,
      area0?.opinion_validada,
    );
    check(
      'D2 solo entrada: docs_faltantes=4',
      rowEntrada?.docs_faltantes === 4,
      rowEntrada?.docs_faltantes,
    );

    await agreementsService.uploadRoadmapDocument(
      Number(item0.id),
      fakeFile('salida-0.pdf'),
      'salida',
    );
    const rowEntSal = await findRow(Number(created.id));
    const area0b = rowEntSal?.areas.find((a) => a.area_name === item0.area_name);
    check(
      'D3 entrada+salida: opinion_validada=true (Ã¡rea 1)',
      area0b?.opinion_validada === true,
      area0b?.opinion_validada,
    );
    check(
      'D4 entrada+salida: docs_faltantes=3',
      rowEntSal?.docs_faltantes === 3,
      rowEntSal?.docs_faltantes,
    );
    check(
      'D5 entrada+salida: progreso=25',
      rowEntSal?.progreso === 25,
      rowEntSal?.progreso,
    );

    /* ============ CASO E: subir "Convenio Firmado / Actualizado" ============ */
    const updated: any = await agreementsService.update(
      Number(created.id),
      {},
      { document: [fakeFile('convenio-firmado.pdf')] },
    );
    check(
      'E1 update: final_document_exists=true',
      updated.final_document_exists === true,
      updated.final_document_exists,
    );
    check('E2 update: status=Vigente', updated.status === 'Vigente', updated.status);
    const finalDoc = (updated.documents ?? []).find(
      (d: any) => d.name === FINAL_DOCUMENT_NAME,
    );
    check(
      'E3 update: documento final con nombre canÃ³nico',
      Boolean(finalDoc),
      finalDoc?.name,
    );

    const rowFinal = await findRow(Number(created.id));
    check(
      'F1 seguimiento: progreso=100',
      rowFinal?.progreso === 100,
      rowFinal?.progreso,
    );
    check(
      'F2 seguimiento: TODAS las Ã¡reas opinion_validada=true',
      (rowFinal?.areas ?? []).every((a) => a.opinion_validada === true),
    );
    check(
      'F3 seguimiento: docs_faltantes SIGUE=3 (existencia documental)',
      rowFinal?.docs_faltantes === 3,
      rowFinal?.docs_faltantes,
    );
    check(
      'F4 seguimiento: pendiente_completar=false',
      rowFinal?.pendiente_completar === false,
      rowFinal?.pendiente_completar,
    );
    check(
      'F5 seguimiento: opiniones_validadas=true',
      rowFinal?.opiniones_validadas === true,
      rowFinal?.opiniones_validadas,
    );
    const notifAfter = await notificationsService.findAll();
    check(
      'G1 notificaciones: sin pending_area tras documento final',
      notifAfter.items.some(
        (n) => n.type === 'pending_area' && n.agreement_id === Number(created.id),
      ) === false,
    );
    check(
      'G2 notificaciones (lÃ³gica): pendiente=false',
      (await hasPendingAreaInDb(Number(created.id))) === false,
    );

    /* ============ CASO H: eliminar el documento final (caso #18) ============ */
    await agreementsService.removeAgreementDocument(Number(finalDoc?.id));
    const afterDelete: any = await agreementsService.findOne(Number(created.id));
    check(
      'H1 delete final: final_document_exists=false (estado derivado)',
      afterDelete.final_document_exists === false,
      afterDelete.final_document_exists,
    );
    check(
      'H2 delete final: status permanece Vigente',
      afterDelete.status === 'Vigente',
      afterDelete.status,
    );
    const rowAfterDel = await findRow(Number(created.id));
    const area0c = rowAfterDel?.areas.find((a) => a.area_name === item0.area_name);
    check(
      'H3 delete final: Ã¡rea 1 (con entrada+salida) sigue validada',
      area0c?.opinion_validada === true,
      area0c?.opinion_validada,
    );
    const otras = (rowAfterDel?.areas ?? []).filter(
      (a) => a.area_name !== item0.area_name,
    );
    check(
      'H4 delete final: otras Ã¡reas vuelven a pendiente (consecuencia del estado derivado)',
      otras.every((a) => a.opinion_validada === false),
    );
    check(
      'H5 delete final: progreso=25',
      rowAfterDel?.progreso === 25,
      rowAfterDel?.progreso,
    );

    /* ============ CASO I: convenio creado CON documento final ============ */
    const createdWithDoc: any = await agreementsService.create(
      {
        title: `AAAAA-PRUEBA-ETAPA10-I-${suffix}`,
        resolution_number: `TEST-I-${suffix}`,
        institution_id: Number(institution.id),
        agreement_type_id: Number(type.id),
      },
      { document: [fakeFile('firmado-create.pdf')] },
    );
    check(
      'I1 create con document: final_document_exists=true',
      createdWithDoc.final_document_exists === true,
      createdWithDoc.final_document_exists,
    );
    const docName = (createdWithDoc.documents ?? []).find(
      (d: any) => d.name === FINAL_DOCUMENT_NAME,
    );
    check(
      'I2 create con document: nombre canÃ³nico',
      Boolean(docName),
      docName?.name,
    );
    check(
      'I3 create con document: status=Vigente',
      createdWithDoc.status === 'Vigente',
      createdWithDoc.status,
    );
    check(
      'I4 create con document: áreas is_completed=true',
      (createdWithDoc.roadmap_items ?? []).every((i: any) => i.is_completed === true),
    );
    const rowCW = await findRow(Number(createdWithDoc.id));
    check(
      'I5 create con document: progreso=100',
      rowCW?.progreso === 100,
      rowCW?.progreso,
    );

    /* ============ LIMPIEZA ============ */
    await agreementsService.remove(Number(created.id));
    testAgreementId = null;
    await agreementsService.remove(Number(createdWithDoc.id));
  } catch (err) {
    results.push(
      `FAIL | EXCEPCIÃ“N: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    if (testAgreementId) {
      try {
        await agreementsService.remove(testAgreementId);
      } catch {
        /* cleanup */
      }
    }
    console.log('\n===== VERIFICACIÃ“N ETAPA 10 =====');
    for (const r of results) console.log(r);
    const pass = results.filter((r) => r.startsWith('PASS')).length;
    const fail = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${pass} PASS / ${fail} FAIL`);
    await prisma.$disconnect();
  }
}

main();

