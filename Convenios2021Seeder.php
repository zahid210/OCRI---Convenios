<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Agreement;
use App\Models\Institution;
use App\Models\AgreementType;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class Convenios2021Seeder extends Seeder
{
    public function run()
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        
        $tipos = [
            'marco' => AgreementType::firstOrCreate(['name' => 'Convenio Marco']),
            'especifico' => AgreementType::firstOrCreate(['name' => 'Convenio Específico']),
            'memorando' => AgreementType::firstOrCreate(['name' => 'Memorando de Entendimiento']),
        ];
        
        $datos = [
            ['001-2021', 'BANCO DE COMERCIO', 'Empresa Nacional', 'CONVENIO PARA EL OTORGAMIENTO DE PRÉSTAMOS PERSONALES BAJO LA MODALIDAD DE (DESCUENTO POR PLANILLA)', '2021-06-01', '2022-06-01', 'Perú'],
            ['002-2021', 'BANCO CONTINENTAL', 'Empresa Nacional', 'CONVENIO PARA EL OTORGAMIENTO DE PRÉSTAMOS PERSONALES BAJO LA MODALIDAD DE DESCUENTO POR PLANILLA', '2021-06-15', '2023-06-15', 'Perú'],
            ['003-2021', 'CALIDAD VISUAL SAC', 'Empresa Nacional', 'CONVENIO DE COOPERACIÓN ENTRE CALIDAD VISUAL SAC Y LA UNCP', '2021-06-18', '2023-06-18', 'Perú'],
            ['004-2021', 'CENTRO DE ESTUDIOS LATINOAMERICANOS DE EDUCACIÓN INCLUSIVA (CELEI)', 'Universidad Internacional', 'CONVENIO MARCO DE COOPERACIÓN ACADÉMICA E INVESTIGACIÓN', '2021-05-03', '2026-05-03', 'Chile'],
            ['005-2021', 'HOSPITAL DOMINGO OLAVEGOYA DE JAUJA', 'Salud', 'RENOVACION CONVENIO ESPECÍFICO DE COOPERACIÓN DOCENTE ASISTENCIAL', '2021-07-15', '2023-07-15', 'Perú'],
            ['006-2021', 'INSTITUCION EDUCATIVA TECNICA MARÍA INMACULADA', 'Educación', 'CONVENIO ESPECÍFICO ENTRE LA FACULTAD DE TRABAJO SOCIAL Y LA I.E. MARÍA INMACULADA', '2021-05-31', '2024-05-31', 'Perú'],
            ['007-2021', 'COMUNIDAD CAMPESINA DE PACA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2021-08-05', '2026-08-05', 'Perú'],
            ['008-2021', 'COMUNIDAD CAMPESINA DE ULLUSCA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2021-08-05', '2026-08-05', 'Perú'],
            ['009-2021', 'COMUNIDAD CAMPESINA DEL TINGO', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2021-08-05', '2026-08-05', 'Perú'],
            ['010-2021', 'COMUNIDAD CAMPESINA DE TINGO PACCHA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2021-08-05', '2026-08-05', 'Perú'],
            ['011-2021', 'COMUNIDAD CAMPESINA DE POMACANCHA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2021-08-05', '2026-08-05', 'Perú'],
            ['012-2021', 'COMUNIDAD CAMPESINA DE TRAGADERO', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2021-08-05', '2026-08-05', 'Perú'],
            ['013-2021', 'IE CORY COYLLOR', 'Educación', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2021-08-05', '2026-08-05', 'Perú'],
            ['014-2021', 'UNIVERSIDAD CONTINENTAL SAC', 'Universidad Privada', 'ACUERDO DE ASOCIACIÓN PROYECTO YACHAY', '2021-04-01', '2023-10-14', 'Perú'],
            ['015-2021', 'INSTITUCION EDUCATIVA POLITÉCNINO TUPAC AMARU', 'Educación', 'CONVENIO ESPECÍFICO FACULTAD DE TRABAJO SOCIAL Y POLITECNICO TUPAC AMARU', '2021-05-31', '2024-05-31', 'Perú'],
            ['016-2021', 'ESCUELA SUPERIOR DE AGRICULTURA LUIZ DE QUEIROZ', 'Universidad Internacional', 'CONVENIO ACADÉMICO INTERNACIONAL', '2021-07-31', '2026-07-31', 'Brasil'],
            ['017-2021', 'INSTITUTO PEDAGÓGICO TEODORO PEÑALOZA', 'Educación', 'CONVENIO ESPECIFICO FACULTAD DE TRABAJO SOCIAL', '2021-10-01', '2024-10-01', 'Perú'],
            ['018-2021', 'COMUNIDAD CAMPESINA DE CHONGOS BAJO', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-10-20', '2026-10-20', 'Perú'],
            ['019-2021', 'COMUNIDAD CAMPESINA DE AHUAC', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-10-20', '2026-10-20', 'Perú'],
            ['020-2021', 'COMUNIDAD CAMPESINA DE CHACAPAMPA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-10-20', '2026-10-20', 'Perú'],
            ['021-2021', 'COMUNIDAD CAMPESINA DE CHUPURO', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-10-20', '2026-10-20', 'Perú'],
            ['022-2021', 'COMUNIDAD CAMPESINA DE COLCA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-10-20', '2026-10-20', 'Perú'],
            ['023-2021', 'COMUNIDAD CAMPESINA DE HUAMANMARCA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-07-19', '2024-07-19', 'Perú'],
            ['024-2021', 'COMUNIDAD CAMPESINA DE HUASICANCHA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-10-20', '2026-10-20', 'Perú'],
            ['025-2021', 'COMUNIDAD CAMPESINA DE HUAYUCACHI', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-10-20', '2026-10-20', 'Perú'],
            ['026-2021', 'COMUNIDAD CAMPESINA DE PUCARA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-10-20', '2026-10-20', 'Perú'],
            ['027-2021', 'COMUNIDAD CAMPESINA DE QUILCAS', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-10-20', '2026-10-20', 'Perú'],
            ['028-2021', 'COMUNIDAD CAMPESINA DE SAPALLANGA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-10-20', '2026-10-20', 'Perú'],
            ['029-2021', 'COMUNIDAD CAMPESINA DE VIQUES', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-10-20', '2026-10-20', 'Perú'],
            ['030-2021', 'I.E. N° 30637 ANDRES AVELINO CACERES', 'Educación', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2023-11-05', 'Perú'],
            ['031-2021', 'IE EIB ALIPIO PONCE VASQUEZ', 'Educación', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2023-11-05', 'Perú'],
            ['032-2021', 'IE CEBA SAN MARTIN', 'Educación', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2023-11-05', 'Perú'],
            ['033-2021', 'IE JOSÉ CARLOS MARIATEGUI', 'Educación', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2023-11-05', 'Perú'],
            ['034-2021', 'IE RAFAEL HOYOS RUBIO', 'Educación', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2023-11-05', 'Perú'],
            ['035-2021', 'IE SAN MARTIN DE PANGOA', 'Educación', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2023-11-05', 'Perú'],
            ['036-2021', 'IE SANTA ROSA DE SANGARENI', 'Educación', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2023-11-05', 'Perú'],
            ['037-2021', 'MUNICIPALIDAD DISTRITAL DE PANGOA', 'Sector Público', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-04', '2026-11-04', 'Perú'],
            ['038-2021', 'OCAREP', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2023-11-05', 'Perú'],
            ['039-2021', 'KANUJA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2023-11-05', 'Perú'],
            ['040-2021', 'UNIVERSIDAD CATÓLICA DEL PERÚ', 'Universidad Privada', 'CONVENIO DE ASOCIACIÓN', '2021-08-03', '2022-08-03', 'Perú'],
            ['041-2021', 'IREN CENTRO', 'Salud', 'CONVENIO ESPECÍFICO DE COOPERACIÓN DOCENTE ASISTENCIAL', '2021-01-01', '2021-12-31', 'Perú'],
            ['042-2021', 'CENTRO DE EDUCACIÓN TÉCNICO PRODUCTIVA CHUPACA', 'Educación', 'CONVENIO ESPECIFICO FACULTAD DE TRABAJO SOCIAL', '2021-09-30', '2024-09-30', 'Perú'],
            ['043-2021', 'CAREC', 'Otros', 'RENOVACIÓN DE CONVENIO MARCO DE COOPERACIÓN', '2021-10-25', '2024-10-25', 'Perú'],
            ['044-2021', 'COMANDO DE SALUD DEL EJÉRCITO (COSALE)', 'Salud', 'CONVENIO ESPECÍFICO DOCENTE ASISTENCIAL', '2021-12-28', '2023-12-28', 'Perú'],
            ['045-2021', 'UNIVERSIDAD NACIONAL INTERCULTURAL SELVA CENTRAL', 'Universidad Nacional', 'CONVENIO DE COOPERACIÓN INTERINSTUCIONAL', '2021-12-17', '2026-12-17', 'Perú'],
            ['046-2021', 'RED DE SALUD VALLE DEL MANTARO', 'Salud', 'CONVENIO ESPECÍFICO DOCENTE ASISTENCIAL', '2021-10-14', '2022-10-14', 'Perú'],
            ['047-2021', 'COMUNIDAD CAMPESINA DE CHOCON', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-08-05', '2023-08-05', 'Perú'],
            ['048-2021', 'COMUNIDAD CAMPESINA DE HUALHUAS', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-12-23', '2023-12-23', 'Perú'],
            ['049-2021', 'COMUNIDAD CAMPESINA DE MARCAPOMACOCHA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-12-10', '2023-12-10', 'Perú'],
            ['050-2021', 'I.E. SAN RAMON', 'Educación', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2023-11-05', 'Perú'],
            ['051-2021', 'COMUNIDAD CAMPESINA DE LA BREÑA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-10-20', '2026-10-20', 'Perú'],
            ['052-2021', 'COMUNIDAD CAMPESINA DE LLOCLLAPAMPA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-08-05', '2023-08-05', 'Perú'],
            ['053-2021', 'COMUNIDAD CAMPESINA DE SANTA ROSA DE SACCO', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-04', '2026-11-04', 'Perú'],
            ['054-2021', 'COMUNIDAD CAMPESINA DE SAN FRANCISCO DE ASIS DE YANTAC', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2026-11-05', 'Perú'],
            ['055-2021', 'COMUNIDAD CAMPESINA DE SUITUCANCHA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2021-11-05', 'Perú'],
            ['056-2021', 'COMUNIDAD CAMPESINA DE SAN JERÓNIMO DE LA OROYA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-12-10', '2026-12-10', 'Perú'],
            ['057-2021', 'COMUNIDAD CAMPESINA DE PACHACHACA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-05', '2026-11-05', 'Perú'],
            ['058-2021', 'COMUNIDAD CAMPESINA DE HUAYPACHA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-06', '2026-11-06', 'Perú'],
            ['059-2021', 'COMUNIDAD CAMPESINA DE CARHUACAYAN', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-10', '2026-11-10', 'Perú'],
            ['060-2021', 'COMUNIDAD CAMPESINA DE PURISIMA CONCEPCIÓN PACCHA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-08', '2026-11-08', 'Perú'],
            ['061-2021', 'COMUNIDAD CAMPESINA DE CHUQUIQUIRPAY', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-09', '2026-11-09', 'Perú'],
            ['062-2021', 'COMUNIDAD CAMPESINA DE HUAYNACANCHA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-10', '2026-11-10', 'Perú'],
            ['063-2021', 'COMUNIDAD CAMPESINA DE HUAYHUAY', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-11-11', '2023-11-11', 'Perú'],
            ['064-2021', 'COMUNIDAD CAMPESINA DE CHACAPALPA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-08-05', '2026-08-05', 'Perú'],
            ['065-2021', 'COMUNIDAD CAMPESINA DE HUARIPAMPA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-08-05', '2026-08-05', 'Perú'],
            ['066-2021', 'COMUNIDAD CAMPESINA DE MARCO', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-08-05', '2026-08-05', 'Perú'],
            ['067-2021', 'COMUNIDAD CAMPESINA DE NUEVA ESPERANZA DE APATA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-08-05', '2026-08-05', 'Perú'],
            ['068-2021', 'COMUNIDAD CAMPESINA DE 3ER CUARTEL-ACOLLA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-08-05', '2026-08-05', 'Perú'],
            ['069-2021', 'COMUNIDAD CAMPESINA DE 2DO CUARTEL ACOLLA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-08-05', '2026-08-05', 'Perú'],
            ['070-2021', 'COMUNIDAD CAMPESINA DE SALLAHUACHAC', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-08-05', '2026-08-05', 'Perú'],
            ['071-2021', 'COMUNIDAD CAMPESINA DE ARAMACHAY', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-08-05', '2026-08-05', 'Perú'],
            ['072-2021', 'COMUNIDAD CAMPESINA DE MOLINOS', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-08-05', '2026-08-05', 'Perú'],
            ['073-2021', 'COMUNIDAD CAMPESINA DE HUERTAS', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN', '2021-08-05', '2026-08-05', 'Perú'],
            ['074-2021', 'UNIVERSIDAD DE ESTUDIOS INTERNACIONALES DE HEBEI', 'Universidad Internacional', 'CONVENIO DE COOPERACIÓN INTERINSTITUCIONAL', '2021-09-02', '2026-09-02', 'China'],
            ['075-2021', 'FUNDACIÓN PARA EL DESARROLLO DEL CENTRO DEL PERÚ (FUDEC)', 'Otros', 'CONVENIO ESPECÍFICO DE DONACIÓN CONDICIONADA', '2021-08-04', '2023-08-04', 'Perú'],
            ['076-2021', 'FUNDACIÓN PARA EL DESARROLLO DEL CENTRO DEL PERÚ (FUDEC)', 'Otros', 'ADENDA AL CONVENIO ESPECÍFICO DE COOPERACIÓN', '2021-10-21', '2025-10-21', 'Perú'],
            ['077-2021', 'IREN CENTRO', 'Salud', 'CONVENIO ESPECÍFICO DE COOPERACIÓN DOCENTRE ASISTENCIAL', '2021-10-21', '2025-10-21', 'Perú'],
            ['078-2021', 'RED DE SALUD DE SATIPO', 'Salud', 'CONVENIO ESPECÍFICO DE COOPERACIÓN DOCENTE ASISTENCIAL', '2021-11-21', '2023-11-21', 'Perú'],
            ['079-2021', 'MINISTERIO DE EDUCACION', 'Sector Público', 'CONVENIO DE COLABORACION INTERINSTITUCIONAL', '2021-04-13', '2021-12-31', 'Perú'],
            ['080-2021', 'CAJA HUANCAYO', 'Empresa Nacional', 'CONVENIO INTERINSTITUCIONAL PARA PRESTACION DE SERVICIO', '2021-04-05', '2022-04-05', 'Perú'],
            ['081-2021', 'CENTRO INTERNACIONAL DE LA PAPA - CIP', 'Otros', 'CONVENIO DE COLABORACION', '2021-08-25', '2022-02-25', 'Perú'],
            ['082-2021', 'UNIDAD EJECUTORA N°118', 'Sector Público', 'CONVENIO DE COOPERACIÓN INSTITUCIONAL', '2021-08-10', '2022-08-10', 'Perú'],
            ['083-2021', 'INSTITUTO TECNOLÓGICO DE LA PRODUCCIÓN - ITP', 'Sector Público', 'CONVENIO DE COOPERACIÓN', '2021-08-31', '2024-08-31', 'Perú'],
            ['084-2021', 'PROGRAMA NACIONAL DE INNOVACIÓN EN PESCA Y ACUICULTURA', 'Sector Público', 'CONTRATO DE ADJUDICACION DE RECURSOS', '2021-09-18', '2022-09-18', 'Perú'],
            ['085-2021', 'CLINICA DENTAL PREMIUM EIRL', 'Empresa Nacional', 'CONVENIO INTERINSTITUCIONAL', '2021-09-01', '2023-09-01', 'Perú'],
            ['086-2021', 'PROVIAS NACIONAL - MTC', 'Sector Público', 'CONVENIO DE PRÁCTICAS PREPROFECIONALES', '2021-12-30', '2022-03-31', 'Perú'],
        ];

        foreach ($datos as $fila) {
            
            $nombreInstitucion = strtoupper($fila[1]);
            $tipoEstandarizado = $fila[2]; // Ya normalizado en el array
            $pais = $fila[6];

            $institucion = Institution::firstOrCreate(
                ['name' => $nombreInstitucion],
                ['country' => $pais, 'type' => $tipoEstandarizado]
            );

            $nombreLargo = strtoupper($fila[3]);
            
            if (str_contains($nombreLargo, 'MEMORANDO')) {
                $tipoId = $tipos['memorando']->id;
            } elseif (str_contains($nombreLargo, 'ESPECIFICO') || str_contains($nombreLargo, 'ESPECÍFICO') || str_contains($nombreLargo, 'ADENDA') || str_contains($nombreLargo, 'CONTRATO')) {
                $tipoId = $tipos['especifico']->id; 
            } else {
                $tipoId = $tipos['marco']->id;
            }

            $agreement = Agreement::firstOrCreate(
                ['resolution_number' => $fila[0]],
                [
                'title' => $fila[0],
                'name' => $fila[3],
                'resolution_number' => $fila[0],
                'institution_id' => $institucion->id,
                'agreement_type_id' => $tipoId, 
                'start_date' => $fila[4],
                'end_date' => $fila[5],
                'status' => 'Vigente'
            ]);

            $codigo = $fila[0];
            $anio = substr($codigo, -4); 
            $rutaRelativa = "convenios/{$anio}/{$codigo}.pdf"; 

            if (Storage::disk('public')->exists($rutaRelativa)) {
                $agreement->documents()->firstOrCreate(
                    ['file_path' => $rutaRelativa],
                    [
                    'name' => 'Doc - ' . ($agreement->resolution_number ?? $agreement->title),
                    'file_path' => $rutaRelativa,
                    'extension' => 'pdf'
                ]);
            }
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }
}