export const INFO_ORDER = ['como-funciona', 'tipsters', 'ranking', 'precios']

export const INFO_DOCS = {
  'tipsters': {
    slug: 'tipsters',
    short: 'Tipsters',
    title: 'Tipsters en FindYourBet',
    desc: 'Todo lo que necesitas saber para convertirte en tipster y hacer crecer tu comunidad.',
    blocks: [
      { h3: '¿Qué es un tipster en FYB?' },
      { p: 'En FindYourBet, cualquier usuario que publica pronósticos deportivos es considerado un tipster.' },
      { p: 'No existen categorías especiales ni requisitos para empezar. Lo que diferencia a unos tipsters de otros son sus resultados, su constancia y la confianza que generan dentro de la comunidad.' },
      { note: 'Para garantizar la transparencia, todos los picks se registran antes del inicio del evento y no pueden editarse ni eliminarse una vez publicados.' },

      { h3: 'Cómo empezar' },
      { p: 'Convertirte en tipster es muy sencillo:' },
      { ul: [
        'Crea una cuenta gratuita.',
        'Accede a la sección Canales.',
        'Crea tu primer canal.',
        'Publica tu primer pick.',
      ]},
      { p: 'Desde ese momento, tus estadísticas comenzarán a calcularse automáticamente.' },

      { h3: 'Qué puedes hacer como tipster' },
      { p: 'Como tipster podrás:' },
      { ul: [
        'Crear tus propios canales.',
        'Publicar picks con cuota, stake y análisis.',
        'Consultar tu historial completo.',
        'Analizar tu rendimiento mediante estadísticas detalladas.',
        'Ganar seguidores y construir una comunidad.',
        'Recibir interacciones de otros usuarios.',
        'Aparecer en los rankings de la plataforma.',
        'Comunicarte con otros miembros de la comunidad.',
      ]},

      { h3: 'Estadísticas transparentes' },
      { p: 'FindYourBet calcula automáticamente las estadísticas de todos los tipsters a partir de los picks registrados en la plataforma.' },
      { p: 'Entre otras métricas, los usuarios podrán consultar:' },
      { ul: [
        'Win Rate.',
        'Yield.',
        'Cuota media.',
        'Stake medio.',
        'Beneficio acumulado.',
        'Historial de picks.',
      ]},
      { p: 'Las apuestas anuladas permanecen registradas en el historial, pero no afectan a las estadísticas.' },

      { h3: 'Verificación de tipster' },
      { p: 'La insignia de tipster verificado puede ser otorgada por el equipo de FindYourBet a aquellas cuentas que demuestren actividad, consistencia y un comportamiento adecuado dentro de la comunidad.' },
      { p: 'La verificación es visible en el perfil, los canales y los rankings de la plataforma.' },

      { h3: 'Consejos para crecer' },
      { ul: [
        'Publica con regularidad.',
        'Mantén una gestión de stake coherente.',
        'Aporta análisis cuando sea relevante.',
        'Interactúa con tu comunidad.',
        'Prioriza siempre la transparencia frente a los resultados a corto plazo.',
      ]},
      { p: 'La confianza se construye con el tiempo, y las estadísticas ayudan a demostrarla.' },
    ],
  },

  'ranking': {
    slug: 'ranking',
    short: 'Ranking',
    title: 'El sistema de ranking',
    desc: 'Cómo se calcula el ranking de tipsters y qué significa cada posición.',
    blocks: [
      { h3: 'Cómo se calcula el ranking de tipsters' },
      { p: 'El ranking de FindYourBet está diseñado para reflejar de la forma más objetiva posible el rendimiento de los tipsters de la plataforma.' },
      { p: 'Las posiciones se calculan automáticamente a partir de los picks registrados en FYB y no pueden verse alteradas mediante publicidad, acuerdos comerciales, número de seguidores o cualquier otro factor externo.' },

      { h3: 'Criterios de clasificación' },
      { p: 'La métrica principal utilizada para ordenar el ranking es el yield, que representa el rendimiento obtenido en relación con el stake total invertido.' },
      { p: 'Además, el sistema puede tener en cuenta otros factores relevantes para valorar la consistencia y fiabilidad del rendimiento:' },
      { ul: [
        'Yield.',
        'Win Rate.',
        'Volumen de picks registrados.',
        'Cuota media.',
        'Consistencia a lo largo del tiempo.',
      ]},
      { p: 'Para aparecer en determinadas clasificaciones puede exigirse un número mínimo de picks resueltos, evitando así que resultados aislados distorsionen el ranking.' },
      { p: 'Las apuestas anuladas no afectan a ninguna estadística ni posición.' },

      { h3: 'Transparencia ante todo' },
      { p: 'La confianza en un ranking depende de la calidad de los datos que lo componen.' },
      { p: 'Por ello, en FindYourBet:' },
      { ul: [
        'Los picks se registran antes del inicio del evento.',
        'No pueden editarse una vez publicados.',
        'No pueden eliminarse para alterar estadísticas.',
        'Las cuotas y stakes quedan registrados desde el momento de la publicación.',
        'El historial permanece accesible para su consulta.',
      ]},
      { p: 'Esto permite que las estadísticas reflejen el rendimiento real de cada tipster de forma transparente y verificable.' },

      { h3: 'Verificación de tipsters' },
      { p: 'Algunos perfiles pueden mostrar una insignia de verificación (✓).' },
      { p: 'Esta insignia indica que la cuenta ha sido revisada manualmente por el equipo de FindYourBet y cumple determinados criterios de actividad, comportamiento y trayectoria dentro de la plataforma.' },
      { p: 'La verificación no influye en la posición del ranking ni modifica las estadísticas mostradas.' },

      { h3: 'Nuestro objetivo' },
      { p: 'El propósito del ranking es facilitar a los usuarios una herramienta transparente para comparar trayectorias, analizar resultados y descubrir tipsters de forma informada.' },
      { p: 'Ninguna posición, estadística o rendimiento pasado garantiza resultados futuros, por lo que cada usuario debe valorar la información disponible de forma responsable.' },
    ],
  },

  'como-funciona': {
    slug: 'como-funciona',
    short: 'Cómo funciona',
    title: 'Cómo funciona FindYourBet',
    desc: 'Todo lo que necesitas saber para empezar en la red social de pronósticos deportivos.',
    blocks: [
      { h3: '¿Qué es FindYourBet?' },
      { p: 'FindYourBet (FYB) es una red social de pronósticos deportivos. No es una casa de apuestas: es el lugar donde apostadores y tipsters registran sus picks, construyen su historial y conectan con otros apasionados del deporte.' },
      { p: 'En FYB los picks se publican antes del partido y no se pueden editar ni borrar. Lo que ves es real.' },
      { note: 'FYB no organiza ni acepta apuestas. Solo registra pronósticos. Apostar es responsabilidad exclusiva del usuario en su casa de apuestas.' },

      { h3: 'Registro y acceso' },
      { p: 'FYB está en beta pública. Cualquiera puede registrarse de forma gratuita.' },
      { ul: [
        'Puedes registrarte con email y contraseña, o directamente con Google.',
        'Confirmas que tienes 18 años o más.',
        'Eliges un nombre de usuario único.',
        'Completas tu perfil con foto y bio cuando quieras.',
      ]},

      { h3: 'Tu perfil' },
      { p: 'Tu perfil es tu carta de presentación. Muestra tu foto, bio, seguidores, estadísticas de rendimiento y el historial de picks. Cualquiera puede visitar el perfil público de otro usuario y ver su trayectoria completa.' },

      { h3: 'Los canales' },
      { p: 'Cada tipster puede crear sus propios canales donde publica sus picks. Hay canales públicos (abiertos a todos) y canales privados (solo con código de invitación).' },
      { p: 'Dentro de un canal puedes publicar picks, mensajes, imágenes y GIFs.' },

      { h3: 'Los picks' },
      { p: 'Publicar un pick es rápido: evento, selección, cuota, stake (del 1 al 10 según tu confianza), deporte y un análisis opcional. Cuando el partido termina, marcas el resultado: Ganada, Perdida o Nula.' },
      { p: 'Las apuestas nulas (anuladas por el organizador) se guardan en el historial pero no afectan a las estadísticas.' },

      { h3: 'Comunidad' },
      { ul: [
        'Sigue a otros usuarios para ver sus picks en tu feed.',
        'Da like y comenta en los picks que más te gusten.',
        'Envía mensajes directos a cualquier usuario.',
        'Organiza tus conversaciones en carpetas personalizadas.',
      ]},

      { h3: 'El feed' },
      { p: 'El feed tiene dos pestañas: Siguiendo (los picks de los tipsters que sigues, en orden cronológico) y Para ti (picks de tipsters que quizás no conoces todavía).' },
      { p: 'Desde el feed puedes dar like, comentar y seguir a cualquier tipster directamente.' },

      { h3: 'Notificaciones' },
      { p: 'FYB te avisa cuando alguien interactúa con tus picks, empieza a seguirte, se une a tu canal o te manda un mensaje.' },
    ],
  },

  'precios': {
    slug: 'precios',
    short: 'Precios',
    title: 'Precios',
    desc: '',
    blocks: [],
    comingSoon: true,
  },
}
