function buildDefaultRoutineTemplate() {
  const ej = (nombre, target) => ({ id: uid("ej"), nombre, target });

  return {
    id: uid("rutina"),
    nombre: "Plan Entrenamiento Deportivo · 3 días",
    profesor: "Joaquín Güizzo",
    telefono: "3876148022",
    creadaEn: todayISO(),
    dias: [
      {
        id: uid("dia"),
        nombre: "Día 1",
        movilidad: {
          series: 1,
          ejercicios: [
            ej("Dorsiflexión de tobillo", "8/8"),
            ej("Súplica c/ abducción + rotación", "10/10"),
            ej("Rotación torácica desde oso", "8/8"),
            ej("Extensión hombro c/ bastón boca abajo", "8/8"),
          ],
        },
        zonaMedia: {
          series: 2,
          ejercicios: [ej("Bicho muerto", "12"), ej("Press paloff arrodillado", "10/10")],
        },
        bloques: [
          {
            id: uid("bloque"),
            nombre: "Bloque 1",
            series: 4,
            nota: "",
            ejercicios: [
              ej("Drop jump + salto horizontal", "3/3"),
              ej("Saltos resistidos", "10"),
              ej("Subida al cajón reactivo", "8/8"),
            ],
          },
          {
            id: uid("bloque"),
            nombre: "Bloque 2",
            series: 3,
            nota: "",
            ejercicios: [
              ej("Peso muerto trap bar", "6"),
              ej("Remo T", "8"),
              ej("Curl 1 iso martillo + curl bíceps", "10"),
              ej("V ups toco cruzado", "12"),
            ],
          },
          {
            id: uid("bloque"),
            nombre: "Bloque 3",
            series: 3,
            nota: "",
            ejercicios: [
              ej("Flexiones pies TRX + enrollamiento", "10"),
              ej("Bisagra + lanzamiento frontal", "5"),
              ej("Press militar c/ barra sentado", "8"),
            ],
          },
        ],
      },
      {
        id: uid("dia"),
        nombre: "Día 2",
        movilidad: {
          series: 1,
          ejercicios: [
            ej("Rotación tronco acostado", "8/8"),
            ej("Spiderman", "12/12"),
            ej("Flexibilidad isquios dinámica", "8"),
          ],
        },
        zonaMedia: {
          series: 2,
          ejercicios: [ej("Puente glúteo marcha", "10/10"), ej("Bird dog c/ banda", "12/12")],
        },
        bloques: [
          {
            id: uid("bloque"),
            nombre: "Bloque 1",
            series: 3,
            nota: "",
            ejercicios: [
              ej("Iso catch", "4"),
              ej("Empuje de cadera explosivo", "5"),
              ej("Swing c/ cambio de mano", "6/6"),
            ],
          },
          {
            id: uid("bloque"),
            nombre: "Bloque 2",
            series: 3,
            nota: "",
            ejercicios: [
              ej("Sentadilla trasera", "6"),
              ej("Press inclinado alternado", "8/8"),
              ej("Vuelo lateral c/ rotación", "10"),
            ],
          },
          {
            id: uid("bloque"),
            nombre: "Bloque 3",
            series: 3,
            nota: "",
            ejercicios: [
              ej("Cargadas", "5"),
              ej("Remo unilateral c/ rotación polea", "8/8"),
              ej("Extensión tríceps tras nuca polea", "12"),
            ],
          },
          {
            id: uid("bloque"),
            nombre: "Bloque 4",
            series: 4,
            nota: 'HIIT 15" x 15" x 4',
            ejercicios: [ej("Carpa fitball", "15\""), ej("Toco pies", "15\""), ej("Crunch abdominal", "15\"")],
          },
        ],
      },
      {
        id: uid("dia"),
        nombre: "Día 3",
        movilidad: {
          series: 1,
          ejercicios: [
            ej("Ranita + rotación externa cadera", "8"),
            ej("Flexo-extensión rodilla y cadera c/ banda", "8/8"),
            ej("Buda + vuelo frontal", "12"),
          ],
        },
        zonaMedia: {
          series: 2,
          ejercicios: [ej("Cambio de apoyo plancha alta", "10/10"), ej("Recepción split barra", "3/3")],
        },
        bloques: [
          {
            id: uid("bloque"),
            nombre: "Bloque 1",
            series: 3,
            nota: "",
            ejercicios: [
              ej("Iso push split", "2 x 4\""),
              ej("Desplazamiento lateral + salto vertical", "3/3"),
              ej("Aceleración lateral c/ pelota", "4/4"),
            ],
          },
          {
            id: uid("bloque"),
            nombre: "Bloque 2",
            series: 3,
            nota: "",
            ejercicios: [
              ej("Step down", "8/8"),
              ej("Press plano c/ barra", "6\" excéntrica + 6"),
              ej("2do tiempo c/ barra", "3/3"),
              ej("Lanzamiento rotacional mb unilateral", "4/4"),
            ],
          },
          {
            id: uid("bloque"),
            nombre: "Bloque 3",
            series: 3,
            nota: "",
            ejercicios: [ej("Remo pendlay supino", "8"), ej("Air sky", "1 min"), ej("Remo máquina", "1 min")],
          },
        ],
      },
    ],
  };
}
