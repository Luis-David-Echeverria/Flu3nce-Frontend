import type {
    DiagnosticContent,
    PolicyAnalysisContent,
    PolicyDraftContent,
    UnderstandingContent,
} from "@/services/v2/types";

export const diagnosticContent = {
    schemaVersion: "diagnostic-v1",
    dimensions: [
        {
            id: "process_operating_model",
            name: "Process & Operating Model",
            level: 2,
            levelLabel: "En desarrollo",
            severity: "Relevante",
            rationale: "Las aprobaciones todavía dependen de correo y formatos distintos por gerencia.",
            soWhat: "La variación aumenta el retrabajo y vuelve impredecible el tiempo de cobertura.",
            hallazgos: ["No existe una requisición única", "Las devoluciones no tienen una causa registrada"],
            brechas: ["Criterios de entrada", "Responsable de aprobación"],
            recomendaciones: ["Unificar la requisición", "Definir un acuerdo de nivel de servicio"],
            kpisSugeridos: ["Tiempo de aprobación", "Porcentaje de requisiciones devueltas"],
            respuestaImplicita: "Estandarizar antes de automatizar.",
            conexionesInterDimensionales: ["performance_kpis_value", "technology_automation_ai"],
        },
    ],
    resumenEjecutivo: "El proceso funciona, pero depende de coordinación manual y carece de indicadores de tiempo y calidad.",
    hipotesisConsultiva: "Una entrada estandarizada y un tablero compartido reducirían devoluciones y seguimiento por correo.",
    juicioProfesional: "La prioridad es estabilizar el modelo operativo antes de añadir más automatización.",
    criticidadProceso: { nivel: "alta", motivo: "Impacta contratación y continuidad operativa" },
    analisisCruzado: ["La falta de datos impide distinguir demoras por aprobación de demoras por búsqueda."],
    roadmapSugerido: ["Estandarizar requisición", "Medir tiempos", "Automatizar notificaciones"],
    preguntasDescubrimiento: ["¿Quién puede aprobar excepciones?", "¿Qué tiempo objetivo tiene cada etapa?"],
    segundaIteracion: {},
} satisfies DiagnosticContent;

export const understandingContent = {
    schemaVersion: "understanding-v1",
    encabezado: { proceso: "Reclutamiento y selección", area: "Recursos Humanos" },
    objetivo_proceso: { objetivo: "Cubrir vacantes con perfiles adecuados y trazabilidad de la decisión" },
    participantes_sesion: ["Gerencia solicitante", "Recursos Humanos", "Nómina"],
    actores_proceso: ["Solicitante", "Reclutador", "Candidato", "Nómina"],
    resumen_ejecutivo: "La vacante nace en la gerencia, Recursos Humanos valida la requisición y coordina publicación, entrevistas y contratación.",
    descripcion_general: { inicio: "Vacante identificada", fin: "Persona contratada" },
    actividades_secuenciales: ["Preparar requisición", "Validar perfil y presupuesto", "Publicar", "Entrevistar", "Contratar"],
    sistemas_utilizados: ["Correo", "ATS", "Hoja de control"],
    sipoc: { proveedores: ["Gerencias"], entradas: ["Requisición"], salidas: ["Contratación"] },
    volumenes_carga_operativa: { vacantesMensuales: 24 },
    indicadores_desempeno: { actuales: [], sugeridos: ["Tiempo de cobertura", "Tasa de aceptación"] },
    controles_actuales: ["Validación de presupuesto", "Aprobación de perfil"],
    riesgos_identificados: ["Requisiciones incompletas", "Pérdida de trazabilidad"],
    oportunidades_mejora: ["Formulario único", "Visibilidad de estado"],
    hallazgos_complementarios: ["Cada gerencia utiliza una plantilla distinta"],
    reglas_negocio_excepciones: { regla: "No publicar sin presupuesto aprobado" },
    recomendaciones_consultivas: { prioridad: "Estandarizar entrada y responsables" },
    proximos_pasos: ["Validar flujo con los responsables", "Definir indicadores"],
    pain_points_fricciones: ["Seguimiento manual", "Devoluciones por información faltante"],
    dependencias_interacciones: ["Presupuesto", "Nómina", "Gerencia solicitante"],
    requerimientos_digitalizacion: { trazabilidad: true, notificaciones: true },
    flujo: null,
    generacion: null,
    textoNoConsiderado: null,
} satisfies UnderstandingContent;

export const policyAnalysisContent = {
    schemaVersion: "policy-analysis-v1",
    observaciones: [
        { observacion: "No existe un criterio uniforme para conservar expedientes.", evidencia: "Los documentos revisados usan plazos distintos." },
        { observacion: "Las excepciones se autorizan por correo.", evidencia: "No se encontró un registro central de autorizaciones." },
    ],
    necesidades: [
        {
            id: "need-retention",
            nombrePolitica: "Retención de expedientes de candidatos",
            tipoPolitica: "Gobierno de información",
            justificacion: "Unificar plazos y responsables.",
            prioridad: "Alta",
        },
    ],
    politicas: [
        {
            id: "policy-recruitment",
            nombrePolitica: "Política de reclutamiento y selección",
            tipoPolitica: "Recursos Humanos",
            nivelRigidez: "Corporativa",
            prioridad: "Alta",
            objetivo: "Definir criterios y responsabilidades comunes.",
        },
    ],
    narrativa: { conclusion: "Se recomienda formalizar primero los criterios de entrada, excepción y conservación." },
} satisfies PolicyAnalysisContent;

export const policyDraftContent = {
    schemaVersion: "policy-draft-v1",
    policyName: "Política de reclutamiento y selección",
    policyCode: "RH-POL-001",
    policyType: "Recursos Humanos",
    objetivo: "Establecer criterios uniformes para solicitar, evaluar y cubrir vacantes.",
    alcance: "Todas las áreas y centros de trabajo de la organización.",
    definiciones: [
        { termino: "Requisición", definicion: "Solicitud formal para iniciar la cobertura de una vacante." },
    ],
    lineamientosGenerales: ["Toda vacante debe contar con presupuesto y perfil aprobados."],
    lineamientosEspecificos: ["Recursos Humanos registrará el avance y las decisiones de cada etapa."],
    coordinacionInterdepartamental: "La gerencia solicitante, Recursos Humanos y Nómina compartirán responsables y tiempos objetivo.",
    responsables: { gerenciaSolicitante: "Definir la necesidad", recursosHumanos: "Coordinar el proceso", nomina: "Formalizar el alta" },
    otrasDisposiciones: "Las excepciones deberán quedar documentadas.",
    sanciones: "Los incumplimientos se atenderán conforme a la normativa interna aplicable.",
    vigencia: "Revisión anual o cuando cambie el marco normativo.",
} satisfies PolicyDraftContent;
