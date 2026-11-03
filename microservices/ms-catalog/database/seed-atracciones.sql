-- Datos de ejemplo para ms_catalog. Aplicar despues de 001-catalog.sql y booking-projection.sql.
-- Es idempotente: se puede ejecutar varias veces (clave: ope_codigo y atr_slug).
-- Las atracciones quedan PUBLICADAS con perfil Booking, asi que aparecen en la busqueda publica.
BEGIN;

INSERT INTO operador (ope_codigo, ope_nombre, ope_ruc, ope_correo, ope_telefono, ope_direccion, prov_id)
VALUES (9001, 'Vive Lo Ecuador Tours', '1790000000001', 'operaciones@viveloecuador.example', '+59322000000', 'Av. Amazonas N24, Quito', 1)
ON CONFLICT (ope_codigo) DO NOTHING;

CREATE TEMP TABLE seed_atraccion (
  slug text, nombre text, corta text, descripcion text, tipo text,
  lat numeric, lng numeric, direccion text, encuentro text, horas numeric,
  ciu_id smallint, ciudad text, gratis boolean, destacada boolean,
  adulto numeric, categorias text[], comida boolean, transporte boolean, guia boolean,
  horarios text[]
) ON COMMIT DROP;

INSERT INTO seed_atraccion VALUES
('mitad-del-mundo-quito', 'Mitad del Mundo y Museo Intiñan',
 'Recorrido por el monumento ecuatorial y experimentos en la linea.',
 'Visita guiada al monumento de la Mitad del Mundo, el museo etnografico y demostraciones de la fuerza de Coriolis y el equilibrio del huevo sobre la linea ecuatorial.',
 'GUIDED_TOUR', -0.002290, -78.455800, 'Av. Manuel Cordova Galarza, San Antonio de Pichincha', 'Entrada principal del monumento', 3.5,
 1, 'Quito', true, true, 25.00, ARRAY['cultural'], false, true, true, ARRAY['09:00:00','14:00:00']),
('centro-historico-quito', 'Centro Historico de Quito a pie',
 'Plazas, iglesias y calles coloniales del primer Patrimonio Cultural de la Humanidad.',
 'Caminata guiada por la Plaza Grande, la Iglesia de la Compania, la calle La Ronda y miradores del casco colonial, con paradas para probar dulces tradicionales.',
 'GUIDED_TOUR', -0.220200, -78.512300, 'Plaza Grande, Centro Historico', 'Frente al Palacio de Carondelet', 3.0,
 1, 'Quito', true, true, 18.00, ARRAY['cultural','gastronomia'], false, false, true, ARRAY['09:00:00','15:00:00']),
('teleferico-quito', 'Teleferico y Cruz Loma',
 'Ascenso en cabina hasta 4.050 m con vistas a los volcanes.',
 'Viaje en teleferico desde Quito hasta las faldas del Pichincha, con tiempo libre para caminar hacia Cruz Loma y fotografiar la ciudad desde las alturas.',
 'ADMISSION', -0.186300, -78.518900, 'Av. Occidental y Av. La Gasca', 'Estacion inferior del teleferico', 2.5,
 1, 'Quito', false, false, 15.00, ARRAY['montana','aventura'], false, false, false, ARRAY['10:00:00','13:00:00','16:00:00']),
('cotopaxi-dia-completo', 'Parque Nacional Cotopaxi: dia completo',
 'Laguna de Limpiopungo, refugio y senderos al pie del volcan.',
 'Excursion de dia completo al Parque Nacional Cotopaxi con transporte desde Quito, caminata por la laguna de Limpiopungo, ascenso al refugio y almuerzo andino.',
 'DAY_TRIP', -0.683800, -78.436200, 'Parque Nacional Cotopaxi', 'Hotel o punto acordado en Quito', 9.0,
 1, 'Quito', true, true, 65.00, ARRAY['naturales','montana','aventura'], true, true, true, ARRAY['07:00:00']),
('banos-aventura-extrema', 'Banos: aventura y cascadas',
 'Canopy, puentismo y la Ruta de las Cascadas en bicicleta.',
 'Dia de aventura en Banos de Agua Santa con ruta en bicicleta por las cascadas, columpio del fin del mundo, canopy y visita al Pailon del Diablo.',
 'DAY_TRIP', -1.396700, -78.424800, 'Parque Central, Banos de Agua Santa', 'Oficina de turismo de Banos', 8.0,
 3, 'Banos', false, true, 55.00, ARRAY['aventura','naturales'], false, true, true, ARRAY['08:00:00']),
('galapagos-san-cristobal', 'San Cristobal: lobos marinos y snorkel',
 'Snorkel en Kicker Rock y playas con fauna endemica.',
 'Jornada de bahia en San Cristobal con snorkel junto a lobos marinos y tortugas, visita a Playa Punta Carola y almuerzo a bordo.',
 'DAY_TRIP', -0.900000, -89.610000, 'Malecon de Puerto Baquerizo Moreno', 'Muelle municipal', 7.0,
 4, 'Galapagos', true, true, 120.00, ARRAY['naturales','playas'], true, true, true, ARRAY['08:30:00']),
('malecon-2000-guayaquil', 'Guayaquil: Malecon 2000 y Las Penas',
 'Paseo por el malecon, el cerro Santa Ana y el barrio Las Penas.',
 'Recorrido a pie por el Malecon 2000, ascenso por los 444 escalones al cerro Santa Ana y degustacion de encebollado en Las Penas.',
 'GUIDED_TOUR', -2.191000, -79.882300, 'Malecon Simon Bolivar', 'Hemiciclo de la Rotonda', 3.0,
 5, 'Guayaquil', true, false, 20.00, ARRAY['cultural','gastronomia'], true, false, true, ARRAY['09:00:00','16:00:00']),
('ruinas-ingapirca-cuenca', 'Ingapirca y centro de Cuenca',
 'Complejo arqueologico canari-inca y recorrido por Cuenca.',
 'Visita al complejo de Ingapirca, el sitio inca mas importante del pais, y regreso por el centro historico de Cuenca con parada en la Catedral Nueva.',
 'DAY_TRIP', -2.540000, -78.870000, 'Ingapirca, Canar', 'Parque Calderon, Cuenca', 8.5,
 6, 'Cuenca', true, true, 48.00, ARRAY['cultural'], true, true, true, ARRAY['08:00:00']),
('mindo-bosque-nublado', 'Mindo: bosque nublado y mariposas',
 'Observacion de aves, cascadas y chocolate artesanal.',
 'Excursion al bosque nublado de Mindo con caminata a cascadas, visita a la mariposario y taller de elaboracion de chocolate.',
 'DAY_TRIP', -0.050000, -78.775000, 'Mindo, Pichincha', 'Terminal Quitumbe, Quito', 9.0,
 1, 'Quito', false, false, 52.00, ARRAY['naturales','gastronomia'], true, true, true, ARRAY['07:30:00']),
('montanita-surf-playa', 'Montanita: clase de surf y playa',
 'Clase de surf para principiantes y tarde de playa.',
 'Clase de surf de dos horas con instructor, equipo incluido y tiempo libre en la playa de Montanita.',
 'ADMISSION', -1.827400, -80.751300, 'Playa de Montanita, Santa Elena', 'Escuela de surf, calle principal', 4.0,
 7, 'Montanita', false, false, 30.00, ARRAY['playas','aventura'], false, false, true, ARRAY['08:00:00','11:00:00','15:00:00']);

INSERT INTO atraccion (atr_nombre, atr_slug, atr_descripcion, atr_descripcion_corta, atr_tipo, atr_estado,
                       atr_latitud, atr_longitud, atr_direccion, atr_punto_encuentro, atr_duracion_horas,
                       ciu_id, ope_id, atr_cancelacion_gratuita, atr_horas_cancelacion, atr_destacada,
                       atr_calificacion_promedio, atr_numero_resenas)
SELECT s.nombre, s.slug, s.descripcion, s.corta, s.tipo, 'PUBLICADA',
       s.lat, s.lng, s.direccion, s.encuentro, s.horas,
       s.ciu_id, o.ope_id, s.gratis, 24, s.destacada,
       4.5, 12
FROM seed_atraccion s
CROSS JOIN (SELECT ope_id FROM operador WHERE ope_codigo = 9001) o
ON CONFLICT (atr_slug) DO NOTHING;

INSERT INTO atraccion_categoria (atr_id, cat_id)
SELECT a.atr_id, c.cat_id
FROM seed_atraccion s
JOIN atraccion a ON a.atr_slug = s.slug
JOIN categoria c ON c.cat_slug = ANY (s.categorias)
ON CONFLICT DO NOTHING;

INSERT INTO atraccion_idioma (atr_id, idi_id)
SELECT a.atr_id, i.idi_id
FROM seed_atraccion s
JOIN atraccion a ON a.atr_slug = s.slug
JOIN idioma i ON i.idi_codigo IN ('es', 'en')
ON CONFLICT DO NOTHING;

INSERT INTO atraccion_foto (atr_id, fot_url, fot_alt, fot_orden)
SELECT a.atr_id, 'https://picsum.photos/seed/' || s.slug || '/1200/800', s.nombre, 0
FROM seed_atraccion s
JOIN atraccion a ON a.atr_slug = s.slug
WHERE NOT EXISTS (SELECT 1 FROM atraccion_foto f WHERE f.atr_id = a.atr_id);

INSERT INTO booking_attraction_profile (atr_id, payload)
SELECT a.atr_id,
  jsonb_build_object(
    'city', s.ciudad,
    'price', jsonb_build_object(
      'currency', 'USD',
      'adult', s.adulto,
      'child', round(s.adulto * 0.5, 2),
      'senior', round(s.adulto * 0.8, 2),
      'infant', 0,
      'student', round(s.adulto * 0.7, 2)),
    'inclusions', jsonb_build_object(
      'includes_food', s.comida,
      'includes_transport', s.transporte,
      'includes_guide', s.guia),
    'itinerary', jsonb_build_array(
      jsonb_build_object('stop_number', 1, 'time', to_char(s.horarios[1]::time, 'HH24:MI'), 'title', 'Encuentro y bienvenida', 'duration_minutes', 15),
      jsonb_build_object('stop_number', 2, 'time', to_char(s.horarios[1]::time + interval '30 minutes', 'HH24:MI'), 'title', s.nombre, 'duration_minutes', GREATEST((s.horas * 60)::int - 45, 30))),
    'ratings_breakdown', jsonb_build_object('limpieza', 9.0, 'servicio', 9.2, 'calidad_precio', 8.8, 'puntualidad', 9.1),
    'accessibility', jsonb_build_object('wheelchair_accessible', false, 'service_animals_allowed', true),
    'permite_paquete', false,
    'schedule_times', to_jsonb(s.horarios))
FROM seed_atraccion s
JOIN atraccion a ON a.atr_slug = s.slug
ON CONFLICT (atr_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();

COMMIT;
