// Contingut dels documents legals de FindYourBet (FYB).
//
// IMPORTANT (per a l'equip de FYB):
// Aquests textos són una base sòlida i adaptada al model de negoci real de FYB
// (marketplace de PRONÒSTICS / informació esportiva — NO és un operador de joc ni
// s'apuesta dins la plataforma). Tot i això NO substitueixen l'assessorament d'un
// advocat. Abans d'obrir al públic seriós, cal:
//   1. Omplir les dades marcades amb ⟦…⟧ (raó social, NIF, adreça fiscal, registre).
//   2. Fer-los revisar per un advocat especialitzat en dret digital / dret del joc.
//
// Estructura data-driven: cada bloc és un objecte que el renderer (LegalPage) pinta.
//   { p: '…' }          → paràgraf
//   { h3: '…' }         → subtítol
//   { ul: ['…', …] }    → llista de punts
//   { note: '…' }       → caixa destacada (avís)

// Dades que l'equip ha d'omplir amb la informació legal real de l'entitat titular.
export const COMPANY = {
  brand: 'FindYourBet',
  legalName: '⟦RAZÓN SOCIAL / NOMBRE Y APELLIDOS DEL TITULAR⟧',
  taxId: '⟦NIF / CIF⟧',
  address: '⟦DIRECCIÓN FISCAL COMPLETA⟧',
  registry: '⟦DATOS REGISTRALES (si es sociedad) — Registro Mercantil, tomo, folio, hoja⟧',
  email: 'fyourbet@gmail.com',
  domain: 'fyourbet.com',
}

export const LAST_UPDATED = '2 de julio de 2026'

// Ordre en què es mostren al footer / índexs.
export const LEGAL_ORDER = ['aviso-legal', 'terminos', 'privacidad', 'cookies', 'juego-responsable']

export const LEGAL_DOCS = {
  // ─────────────────────────────────────────────────────────────────────────
  'aviso-legal': {
    slug: 'aviso-legal',
    title: 'Aviso Legal',
    short: 'Aviso Legal',
    desc: 'Datos identificativos del titular y condiciones generales de uso del sitio web.',
    blocks: [
      { h3: '1. Datos identificativos' },
      { p: `En cumplimiento de lo dispuesto en el artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa a los usuarios de que el titular del presente sitio web es:` },
      { ul: [
        `Titular: ${COMPANY.legalName}`,
        `NIF/CIF: ${COMPANY.taxId}`,
        `Domicilio: ${COMPANY.address}`,
        `Datos registrales: ${COMPANY.registry}`,
        `Correo electrónico de contacto: ${COMPANY.email}`,
        `Sitio web: ${COMPANY.domain}`,
      ] },

      { h3: '2. Objeto y naturaleza del servicio' },
      { p: `FindYourBet (en adelante, "FYB" o "la Plataforma") es una red social y un marketplace digital de información y pronósticos deportivos. Su finalidad es facilitar el contacto entre usuarios que comparten análisis y pronósticos deportivos ("tipsters") y aquellos usuarios interesados en acceder a dicho contenido.` },
      { p: `FindYourBet no es un operador de juego ni una casa de apuestas. A través de la Plataforma no se realizan apuestas, no se aceptan ni gestionan cantidades destinadas al juego y no se abonan premios vinculados a resultados deportivos.` },
      { p: `La actividad de FYB se limita a proporcionar un entorno tecnológico para la publicación, difusión, seguimiento y suscripción a contenidos informativos relacionados con el ámbito deportivo.` },

      { h3: '3. Condiciones de acceso y uso' },
      { p: `El acceso a la Plataforma es gratuito, sin perjuicio de que determinados contenidos premium puedan requerir una suscripción o un pago puntual gestionado por los correspondientes tipsters.` },
      { p: `El acceso y utilización de los servicios ofrecidos por FindYourBet están reservados exclusivamente a personas mayores de 18 años.` },
      { p: `El usuario se compromete a utilizar la Plataforma de forma lícita, responsable y conforme a la legislación vigente, así como a respetar los presentes términos y condiciones y los derechos de terceros.` },

      { h3: '4. Propiedad intelectual e industrial' },
      { p: `La marca "FindYourBet", su logotipo, el diseño del sitio web, el código fuente, las bases de datos y cualesquiera otros elementos que integran la Plataforma son titularidad de su propietario o se utilizan bajo las correspondientes licencias, encontrándose protegidos por la normativa aplicable en materia de propiedad intelectual e industrial.` },
      { p: `Los contenidos publicados por los tipsters o por cualquier otro usuario serán responsabilidad exclusiva de sus respectivos autores, quienes conservarán los derechos que legalmente les correspondan sobre dichos contenidos.` },

      { h3: '5. Exención de responsabilidad' },
      { p: `El titular de la Plataforma no será responsable de las decisiones adoptadas por los usuarios a partir de la información, análisis o pronósticos publicados en FindYourBet.` },
      { p: `Los pronósticos difundidos a través de la Plataforma constituyen opiniones personales de sus autores y no deben interpretarse como asesoramiento financiero, recomendación de inversión o garantía de resultado alguno.` },
      { p: `Asimismo, el titular no garantiza la disponibilidad permanente e ininterrumpida del sitio web ni la ausencia de errores técnicos, incidencias de funcionamiento o interrupciones derivadas de causas ajenas a su control.` },

      { h3: '6. Legislación aplicable y jurisdicción' },
      { p: `Las presentes condiciones se regirán e interpretarán de conformidad con la legislación española.` },
      { p: `Para la resolución de cualquier controversia que pudiera derivarse del acceso, navegación o utilización de la Plataforma, las partes se someterán a los juzgados y tribunales que resulten competentes de acuerdo con la normativa aplicable en materia de consumidores y usuarios.` },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  'terminos': {
    slug: 'terminos',
    title: 'Términos y Condiciones',
    short: 'Términos y Condiciones',
    desc: 'Condiciones que regulan el uso de FindYourBet, tanto para usuarios como para tipsters.',
    blocks: [
      { p: `Los presentes Términos y Condiciones (los "Términos") regulan el acceso, registro y uso de la plataforma FindYourBet ("FYB" o la "Plataforma").` },
      { p: `Al acceder, registrarte o utilizar la Plataforma, aceptas íntegramente los presentes Términos y Condiciones. Si no estás de acuerdo con alguno de ellos, deberás abstenerte de utilizar los servicios ofrecidos por FYB.` },

      { h3: '1. Descripción del servicio' },
      { p: `FYB es una red social y marketplace de pronósticos deportivos que permite a los usuarios registrar y compartir pronósticos ("picks"), seguir a otros usuarios, crear canales públicos o privados y ofrecer o acceder a contenido premium mediante suscripción.` },
      { p: `FYB no es un operador de juego ni una casa de apuestas. A través de la Plataforma no se realizan apuestas, no se aceptan ni gestionan cantidades destinadas al juego y no se abonan premios vinculados a resultados deportivos.` },
      { p: `FYB facilita exclusivamente el acceso a información, análisis y opiniones deportivas publicadas por sus usuarios, sin intervenir en actividades de juego o apuestas.` },

      { h3: '2. Requisitos de acceso' },
      { p: `Para utilizar la Plataforma, el usuario declara y garantiza que:` },
      { ul: [
        `Es mayor de 18 años.`,
        `Reside en una jurisdicción donde el acceso a este tipo de servicios sea legal.`,
        `Proporcionará información veraz, exacta y actualizada durante el proceso de registro y utilización de la Plataforma.`,
        `Mantendrá la confidencialidad de sus credenciales de acceso y será responsable de cualquier actividad realizada desde su cuenta.`,
      ] },

      { h3: '3. Cuentas de usuario' },
      { p: `El registro en FYB requiere la creación de una cuenta mediante un nombre de usuario, una dirección de correo electrónico válida y la aceptación expresa de los presentes Términos y de la Política de Privacidad.` },
      { p: `FYB se reserva el derecho de suspender, limitar o cancelar cuentas que incumplan estos Términos, suplanten identidades, publiquen contenido ilícito o fraudulento, o realicen actividades que puedan perjudicar a la Plataforma o a su comunidad de usuarios.` },

      { h3: '4. Tipsters y contenido publicado' },
      { p: `Cualquier usuario podrá publicar pronósticos deportivos y crear canales gratuitos o de pago dentro de la Plataforma.` },
      { p: `El tipster será el único responsable del contenido que publique y, al hacerlo, declara y garantiza que:` },
      { ul: [
        `Los pronósticos, análisis y opiniones publicados tienen carácter exclusivamente informativo y no constituyen garantía de resultado alguno.`,
        `No incluirá enlaces de afiliación, publicidad o promociones de operadores de juego o casas de apuestas, especialmente cuando dichos operadores no cuenten con las autorizaciones legalmente exigidas.`,
        `No publicará contenido falso, engañoso, difamatorio, ilícito o susceptible de inducir a error a otros usuarios.`,
        `No fomentará conductas de juego irresponsable ni presentará las apuestas como una fuente garantizada de ingresos.`,
        `Cumplirá con las obligaciones fiscales y legales que pudieran derivarse de los ingresos obtenidos a través de la Plataforma.`,
      ] },

      { h3: '5. Contenido de pago, pagos y comisiones' },
      { p: `Los pagos correspondientes a suscripciones, accesos premium y otros servicios ofrecidos dentro de la Plataforma se procesan mediante Stripe y Stripe Connect.` },
      { p: `Los importes correspondientes serán gestionados conforme a las condiciones establecidas por dicho proveedor de servicios de pago.` },
      { p: `FYB podrá retener una comisión de servicio sobre las transacciones realizadas en la Plataforma. Con carácter general, dicha comisión se situará entre el 15% y el 20%, pudiendo variar según el tipo de cuenta, servicio o plan contratado.` },
      { p: `Los precios aplicables se mostrarán de forma previa a la compra correspondiente. Al completar una transacción, el usuario acepta expresamente el cargo asociado al servicio contratado.` },

      { h3: '6. Política de reembolsos' },
      { p: `Debido a la naturaleza digital del contenido ofrecido y al acceso inmediato al mismo, y de conformidad con el artículo 103 del Real Decreto Legislativo 1/2007, por el que se aprueba la Ley General para la Defensa de los Consumidores y Usuarios, el usuario acepta que el derecho de desistimiento no resultará aplicable una vez iniciado el acceso al contenido digital adquirido.` },
      { p: `No obstante, FYB podrá estudiar solicitudes de reembolso en casos de error de cobro, contenido no entregado, incidencias técnicas relevantes o situaciones de fraude debidamente acreditadas.` },
      { p: `Para cualquier consulta relacionada con pagos o reembolsos, el usuario podrá contactar con: ${COMPANY.email}` },

      { h3: '7. Ausencia de garantías sobre resultados' },
      { p: `Los pronósticos deportivos constituyen opiniones personales y están sujetos a múltiples factores imprevisibles.` },
      { p: `Ningún historial de resultados, rentabilidad (ROI), yield, porcentaje de acierto, racha o cualquier otra estadística mostrada en la Plataforma garantiza resultados futuros.` },
      { p: `El rendimiento pasado de un tipster no constituye una indicación fiable de su rendimiento futuro.` },
      { p: `FYB no garantiza que el seguimiento de un determinado tipster produzca beneficios económicos o resultados concretos.` },
      { p: `Cualquier decisión relacionada con apuestas deportivas que el usuario adopte fuera de la Plataforma será de su exclusiva responsabilidad.` },

      { h3: '8. Transparencia y estadísticas' },
      { p: `FindYourBet promueve la transparencia en la publicación y seguimiento de pronósticos deportivos.` },
      { p: `Las estadísticas, rankings e indicadores mostrados en la Plataforma se generan a partir de la información y los datos registrados en el sistema con la finalidad de facilitar el análisis y comparación entre usuarios y canales.` },
      { p: `No obstante, dichas estadísticas tienen carácter meramente informativo y no constituyen asesoramiento, recomendación personalizada ni garantía alguna de rendimiento futuro.` },

      { h3: '9. Conducta prohibida' },
      { p: `Queda expresamente prohibido:` },
      { ul: [
        `Utilizar la Plataforma para actividades ilícitas, fraudulentas o contrarias a la normativa aplicable.`,
        `Acosar, amenazar, suplantar, difamar o perjudicar a otros usuarios.`,
        `Publicar contenidos protegidos por derechos de terceros sin la debida autorización.`,
        `Manipular estadísticas, resultados, historiales o cualquier otro elemento destinado a reflejar el rendimiento real de una cuenta o canal.`,
        `Crear cuentas falsas o utilizar mecanismos destinados a eludir suspensiones o bloqueos.`,
        `Promocionar operadores de juego o incluir enlaces de afiliación relacionados con casas de apuestas.`,
      ] },

      { h3: '10. Propiedad intelectual' },
      { p: `El software, diseño, marca, logotipos, bases de datos y demás elementos que integran FYB son propiedad de su titular o se utilizan bajo las correspondientes licencias.` },
      { p: `El contenido publicado por cada usuario seguirá siendo de su titularidad. No obstante, mediante su publicación en la Plataforma, el usuario concede a FYB una licencia no exclusiva, gratuita, mundial y limitada a la prestación del servicio para alojar, reproducir, mostrar y distribuir dicho contenido dentro de la Plataforma.` },

      { h3: '11. Suspensión y cancelación' },
      { p: `FYB podrá suspender, limitar o cancelar el acceso de cualquier usuario que incumpla los presentes Términos, sin que ello genere derecho a compensación o indemnización alguna.` },
      { p: `El usuario podrá eliminar su cuenta en cualquier momento mediante las opciones habilitadas en la configuración de la Plataforma.` },

      { h3: '12. Modificaciones' },
      { p: `FYB podrá modificar los presentes Términos y Condiciones cuando resulte necesario para adaptarlos a cambios normativos, mejoras del servicio o nuevas funcionalidades de la Plataforma.` },
      { p: `Cuando resulte razonablemente posible, los cambios sustanciales serán comunicados a los usuarios a través de la Plataforma.` },
      { p: `El uso continuado de los servicios tras la publicación de las modificaciones implicará la aceptación de la versión vigente de los Términos.` },

      { h3: '13. Legislación aplicable y contacto' },
      { p: `Los presentes Términos y Condiciones se regirán e interpretarán de conformidad con la legislación española.` },
      { p: `Para cualquier duda, consulta o comunicación relacionada con estos Términos, puedes contactar con nosotros a través de:` },
      { p: `Correo electrónico: ${COMPANY.email}` },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  'privacidad': {
    slug: 'privacidad',
    title: 'Política de Privacidad',
    short: 'Privacidad',
    desc: 'Cómo tratamos tus datos personales conforme al RGPD y la LOPDGDD.',
    blocks: [
      { p: `En FindYourBet ("FYB") nos tomamos en serio la protección de tus datos personales. Esta política explica qué datos tratamos, con qué finalidad y qué derechos tienes, conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD).` },
      { h3: '1. Responsable del tratamiento' },
      { ul: [
        `Responsable: ${COMPANY.legalName}`,
        `NIF/CIF: ${COMPANY.taxId}`,
        `Domicilio: ${COMPANY.address}`,
        `Contacto: ${COMPANY.email}`,
      ] },
      { h3: '2. Datos que tratamos' },
      { ul: [
        `Datos de registro: nombre, apellidos, nombre de usuario, correo electrónico, fecha de nacimiento y nacionalidad.`,
        `Datos de perfil: biografía, avatar y contenido que publiques voluntariamente.`,
        `Datos de actividad: pronósticos, mensajes, seguimientos, likes y comentarios.`,
        `Datos de pago: gestionados directamente por Stripe. FYB no almacena los datos completos de tu tarjeta.`,
        `Datos técnicos: dirección IP, tipo de dispositivo y datos de uso necesarios para el funcionamiento y la seguridad.`,
      ] },
      { h3: '3. Finalidades y base jurídica' },
      { ul: [
        `Prestar el servicio y gestionar tu cuenta — base: ejecución del contrato (los Términos que aceptas al registrarte).`,
        `Procesar pagos de suscripciones y accesos premium — base: ejecución del contrato.`,
        `Enviar comunicaciones transaccionales (confirmaciones, accesos comprados) — base: ejecución del contrato.`,
        `Garantizar la seguridad y prevenir el fraude o abusos — base: interés legítimo.`,
        `Cumplir obligaciones legales (fiscales, de moderación) — base: obligación legal.`,
      ] },
      { h3: '4. Destinatarios y encargados del tratamiento' },
      { p: `Para prestar el servicio, compartimos datos con proveedores que actúan como encargados del tratamiento, bajo contrato y garantías adecuadas:` },
      { ul: [
        `Supabase — base de datos y autenticación.`,
        `Stripe — procesamiento de pagos.`,
        `Brevo (Sendinblue) — envío de correos transaccionales.`,
        `Vercel — alojamiento e infraestructura web.`,
      ] },
      { p: `No vendemos tus datos personales a terceros.` },
      { h3: '5. Transferencias internacionales' },
      { p: `Algunos de estos proveedores pueden tratar datos fuera del Espacio Económico Europeo. En tales casos, la transferencia se ampara en las garantías previstas por el RGPD (cláusulas contractuales tipo de la Comisión Europea o decisiones de adecuación).` },
      { h3: '6. Conservación' },
      { p: `Conservamos tus datos mientras mantengas tu cuenta activa. Si la eliminas, suprimiremos o anonimizaremos tus datos, salvo aquellos que debamos conservar por obligación legal (por ejemplo, registros de facturación) durante los plazos legalmente exigidos.` },
      { h3: '7. Tus derechos' },
      { p: `Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, escribiendo a ${COMPANY.email}. También tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es) si consideras que no hemos atendido adecuadamente tu solicitud.` },
      { h3: '8. Seguridad' },
      { p: `Aplicamos medidas técnicas y organizativas para proteger tus datos, incluyendo control de acceso a nivel de fila (RLS) en la base de datos, cifrado en tránsito y minimización de datos. Ningún sistema es infalible, pero trabajamos para reducir los riesgos.` },
      { h3: '9. Menores de edad' },
      { p: `FYB está dirigido exclusivamente a mayores de 18 años. No recogemos conscientemente datos de menores. Si detectamos una cuenta de un menor, la eliminaremos.` },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  'cookies': {
    slug: 'cookies',
    title: 'Política de Cookies',
    short: 'Cookies',
    desc: 'Qué cookies y tecnologías de almacenamiento utiliza FindYourBet.',
    blocks: [
      { p: `La presente Política de Cookies explica qué son las cookies y otras tecnologías similares, qué tipos utiliza FindYourBet ("FYB" o la "Plataforma"), con qué finalidad se emplean y qué opciones tiene el usuario para gestionarlas.` },
      { p: `Esta política se ha elaborado de conformidad con lo dispuesto en el artículo 22.2 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), así como con la normativa aplicable en materia de protección de datos.` },

      { h3: '1. ¿Qué son las cookies?' },
      { p: `Las cookies son pequeños archivos de información que se almacenan en el dispositivo del usuario cuando visita un sitio web.` },
      { p: `Su función principal es permitir que el sitio web recuerde determinada información sobre la navegación, la sesión o las preferencias del usuario, facilitando así una experiencia más eficiente y personalizada.` },
      { p: `Además de las cookies tradicionales, algunas funcionalidades pueden utilizar tecnologías equivalentes, como el almacenamiento local del navegador ("Local Storage"), que cumplen funciones similares.` },

      { h3: '2. Cookies y tecnologías que utilizamos' },
      { p: `Actualmente, FindYourBet utiliza únicamente cookies y mecanismos de almacenamiento estrictamente necesarios para el funcionamiento de la Plataforma.` },
      { p: `No utilizamos cookies publicitarias, cookies de seguimiento entre sitios web ni tecnologías destinadas a elaborar perfiles comerciales de los usuarios.` },
      { h3: 'Autenticación y seguridad' },
      { p: `Utilizamos tecnologías gestionadas por Supabase para mantener la sesión iniciada de forma segura, identificar al usuario autenticado y proteger el acceso a las funcionalidades privadas de la Plataforma.` },
      { p: `Estas cookies son esenciales para el funcionamiento del servicio y no pueden desactivarse mientras se utilice una cuenta de usuario.` },
      { h3: 'Preferencias y experiencia de usuario' },
      { p: `Utilizamos almacenamiento local del navegador para recordar determinadas preferencias configuradas por el usuario, tales como:` },
      { ul: [
        `Acceso a funcionalidades beta.`,
        `Organización de carpetas o conversaciones.`,
        `Preferencias de visualización.`,
        `Opciones como "no volver a mostrar este mensaje".`,
        `Ajustes destinados a mejorar la experiencia de navegación.`,
      ] },
      { p: `Estas tecnologías permiten ofrecer una experiencia más cómoda y coherente entre sesiones.` },

      { h3: '3. Cookies de terceros' },
      { p: `Algunas funcionalidades de terceros integradas en la Plataforma pueden utilizar sus propias cookies o tecnologías similares.` },
      { h3: 'Stripe' },
      { p: `Cuando un usuario realiza un pago o contrata una suscripción, Stripe puede establecer cookies propias necesarias para:` },
      { ul: [
        `Procesar pagos de forma segura.`,
        `Detectar y prevenir actividades fraudulentas.`,
        `Garantizar la integridad de las transacciones.`,
      ] },
      { p: `Estas cookies son gestionadas directamente por Stripe y se encuentran sujetas a sus propias políticas de privacidad y cookies.` },

      { h3: '4. Qué no hacemos' },
      { p: `Con el objetivo de ofrecer una experiencia transparente y respetuosa con la privacidad, actualmente FindYourBet:` },
      { ul: [
        `No vende datos personales a terceros.`,
        `No utiliza cookies publicitarias.`,
        `No realiza seguimiento publicitario entre diferentes sitios web.`,
        `No crea perfiles comerciales basados en la navegación del usuario.`,
        `No comparte información con redes publicitarias para fines de marketing comportamental.`,
      ] },
      { p: `Nuestra utilización de cookies se limita exclusivamente a aquellas necesarias para prestar correctamente el servicio y mejorar la experiencia de uso de la Plataforma.` },

      { h3: '5. Gestión de cookies' },
      { p: `La mayoría de navegadores permiten al usuario gestionar, bloquear o eliminar cookies mediante sus opciones de configuración.` },
      { p: `No obstante, dado que las cookies utilizadas por FYB son esencialmente técnicas y necesarias para el funcionamiento del servicio, su desactivación podría impedir:` },
      { ul: [
        `Iniciar sesión correctamente.`,
        `Mantener la sesión activa.`,
        `Acceder a determinadas funcionalidades privadas.`,
        `Conservar preferencias previamente configuradas.`,
      ] },
      { p: `Por este motivo, recomendamos mantener habilitadas las cookies necesarias para garantizar el correcto funcionamiento de la Plataforma.` },

      { h3: '6. Actualizaciones de esta política' },
      { p: `FindYourBet podrá actualizar la presente Política de Cookies cuando resulte necesario para reflejar cambios normativos, mejoras técnicas o la incorporación de nuevas funcionalidades.` },
      { p: `En caso de producirse modificaciones relevantes, estas serán publicadas en esta misma página junto con la fecha de su última actualización.` },
      { p: `Recomendamos revisar periódicamente esta política para mantenerse informado sobre el uso de cookies y tecnologías similares en la Plataforma.` },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  'juego-responsable': {
    slug: 'juego-responsable',
    title: 'Juego Responsable',
    short: 'Juego Responsable',
    desc: 'Información y recursos de ayuda. Los pronósticos conllevan riesgo.',
    blocks: [
      { p: `FindYourBet ("FYB") es una plataforma de información, análisis y pronósticos deportivos. No somos una casa de apuestas ni un operador de juego, y dentro de la Plataforma no se realizan apuestas ni se gestionan fondos destinados al juego.` },
      { p: `Cualquier decisión relacionada con apuestas deportivas que un usuario pueda adoptar se realiza fuera de FindYourBet, a través de operadores autorizados y bajo su exclusiva responsabilidad.` },
      { p: `Promovemos un uso responsable de la información deportiva y defendemos una relación saludable con las actividades de juego y entretenimiento.` },

      { h3: '1. Los pronósticos deportivos implican riesgo' },
      { p: `Los pronósticos deportivos representan opiniones y análisis elaborados por sus respectivos autores.` },
      { p: `Ningún pronóstico, estadística, historial de resultados, yield, ROI, porcentaje de acierto o clasificación mostrada en la Plataforma garantiza ganancias ni asegura resultados futuros.` },
      { p: `Los resultados pasados no constituyen una garantía ni una indicación fiable de rendimientos futuros.` },
      { p: `Las apuestas deportivas implican un riesgo económico real y pueden dar lugar a pérdidas parciales o totales del dinero apostado.` },
      { p: `Por este motivo, recomendamos actuar siempre con prudencia y responsabilidad.` },
      { note: `Nunca apuestes dinero que no puedas permitirte perder.` },

      { h3: '2. Principios de juego responsable' },
      { p: `Si decides participar en actividades de apuestas deportivas, te recomendamos seguir estas pautas:` },
      { ul: [
        `Establece previamente límites de tiempo y presupuesto, y respétalos.`,
        `Considera las apuestas como una forma de entretenimiento y no como una fuente de ingresos.`,
        `No intentes recuperar pérdidas mediante nuevas apuestas impulsivas.`,
        `Evita apostar bajo situaciones de estrés, ansiedad, frustración o alteración emocional.`,
        `Mantén un equilibrio saludable entre el juego, el trabajo, los estudios, la familia y otras actividades personales.`,
        `Realiza pausas periódicas y revisa de forma crítica tus hábitos de juego.`,
      ] },
      { p: `El control y la responsabilidad deben formar parte de cualquier actividad relacionada con las apuestas deportivas.` },

      { h3: '3. Señales de alerta' },
      { p: `Puede ser recomendable buscar ayuda profesional si identificas alguna de las siguientes situaciones:` },
      { ul: [
        `Apostar más dinero del inicialmente previsto de forma habitual.`,
        `Sentir la necesidad de aumentar progresivamente las cantidades apostadas.`,
        `Intentar recuperar pérdidas mediante apuestas cada vez mayores.`,
        `Ocultar o minimizar la actividad de juego ante familiares o amigos.`,
        `Experimentar ansiedad, frustración o malestar cuando no se puede apostar.`,
        `Percibir que las apuestas afectan negativamente a la economía personal, al trabajo, a los estudios o a las relaciones personales.`,
      ] },
      { p: `Reconocer estas señales a tiempo puede ayudar a prevenir problemas más graves.` },

      { h3: '4. ¿Necesitas ayuda? (España)' },
      { p: `Si crees que tú o una persona cercana puede estar desarrollando problemas relacionados con el juego, existen recursos gratuitos, profesionales y confidenciales que pueden ayudarte.` },
      { h3: 'Línea de Atención al Jugador' },
      { p: `900 200 225 — Servicio gratuito y confidencial.` },
      { h3: 'FEJAR — Federación Española de Jugadores de Azar Rehabilitados' },
      { p: `Organización especializada en la prevención y tratamiento de problemas relacionados con el juego.` },
      { p: `www.fejar.org` },
      { h3: 'Registro General de Interdicciones de Acceso al Juego (RGIAJ)' },
      { p: `Permite solicitar voluntariamente la prohibición de acceso a actividades de juego reguladas en España, tanto presenciales como online.` },
      { p: `www.ordenacionjuego.gob.es` },
      { h3: 'Programa Juego Responsable (DGOJ)' },
      { p: `Información, recursos y recomendaciones sobre juego responsable.` },
      { p: `www.jugarbien.es` },

      { h3: '5. Protección de menores' },
      { p: `El acceso y utilización de FindYourBet están reservados exclusivamente a personas mayores de 18 años.` },
      { p: `El juego y las apuestas deportivas están prohibidos para menores de edad conforme a la normativa vigente.` },
      { p: `FindYourBet no está dirigido a menores ni recopila conscientemente información de personas menores de 18 años.` },
      { p: `Recomendamos a padres, madres y tutores legales utilizar herramientas de control parental y supervisión digital para limitar el acceso de menores a contenidos relacionados con apuestas deportivas o actividades de juego.` },

      { h3: '6. Nuestro compromiso' },
      { p: `La transparencia, la responsabilidad y la protección de los usuarios forman parte de los principios fundamentales de FindYourBet.` },
      { p: `Nuestro objetivo es ofrecer una plataforma donde los usuarios puedan compartir y consultar información deportiva de forma segura, transparente y responsable, promoviendo siempre hábitos saludables y una relación equilibrada con las apuestas deportivas.` },
    ],
  },
}
