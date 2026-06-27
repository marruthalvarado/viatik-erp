# FASE 8 — Diseño Técnico del Módulo BI y Reportes
## Viatik ERP · `feature/reportes`
**Fecha:** 2026-06-26 · **Estado:** Diseño completo, listo para implementación

---

## Índice

1. [PASO 1 — Auditoría Funcional del ERP](#paso-1)
2. [PASO 2 — Catálogo de KPIs](#paso-2)
3. [PASO 3 — Catálogo de Reportes](#paso-3)
4. [PASO 4 — Arquitectura BI](#paso-4)
5. [PASO 5 — Modelo de Performance](#paso-5)
6. [PASO 6 — Dashboard Ejecutivo](#paso-6)
7. [PASO 7 — Exportaciones](#paso-7)
8. [PASO 8 — UX y Navegación](#paso-8)
9. [Plan de Implementación por Fases](#plan)

---

## PASO 1 — Auditoría Funcional del ERP {#paso-1}

### 1.1 Entidades disponibles para explotación analítica

#### Módulo Rendiciones
**Tabla:** `rendiciones` (21 columnas)

| Campo | Tipo | Uso analítico |
|---|---|---|
| `fecha_rendicion` | date | Serie temporal, agrupación por mes/año |
| `fecha_envio` | date | Tiempo hasta envío (fecha_envio - created_at) |
| `fecha_aprobacion` | date | Ciclo completo de aprobación (fecha_aprobacion - fecha_envio) |
| `total_facturado` | numeric | KPI financiero principal |
| `total_reembolsable` | numeric | Importe a devolver al empleado |
| `total_anticipos` | numeric | Anticipos descontados |
| `saldo` | numeric | Saldo neto (puede ser negativo) |
| `score_auditoria` | numeric | Score IA de riesgo (0-100) |
| `estado_rendicion_id` | FK | Segmentación por estado: borrador/enviada/aprobada/rechazada/pagada |
| `tipo_rendicion_id` | FK | Segmentación por tipo: viaje/operativa/proyecto |
| `politica_id` | FK | Vinculación con política de reembolso |
| `proyecto_id` | FK | Drill-down a proyecto/cliente |
| `usuario_id` | FK | Análisis por viajero/empleado |
| `workflow_id` | FK | Análisis del workflow de aprobación |

#### Módulo Gastos
**Tabla:** `gastos` (23 columnas)

| Campo | Tipo | Uso analítico |
|---|---|---|
| `fecha` | date | Serie temporal de gastos |
| `valor_factura` | numeric | Monto facturado |
| `valor_reembolsable` | numeric | Monto reembolsable |
| `valor_moneda_base` | numeric | Normalizado a moneda base de empresa |
| `valor_moneda_origen` | numeric | Monto en moneda original |
| `moneda_codigo` | text | Distribución multimoneda |
| `tipo_cambio` | numeric | Tipo de cambio aplicado |
| `categoria_gasto_id` | FK | Clasificación por categoría |
| `estado_gasto_id` | FK | Estado del gasto |
| `origen_gasto_id` | FK | Origen: manual/OCR/importado |
| `proveedor_id` | FK | Drill-down a proveedor |
| `es_manual` | boolean | Proporción manual vs automático |
| `viaje_id` | FK | Gastos asociados a viajes |

#### Módulo Viajes
**Tabla:** `viajes` (12 columnas)

| Campo | Tipo | Uso analítico |
|---|---|---|
| `destino` | text | Destinos más frecuentes |
| `fecha_inicio` / `fecha_fin` | date | Duración del viaje (fecha_fin - fecha_inicio) |
| `distancia_km` | numeric | Kilómetros recorridos, costo/km |
| `pais_id` | FK | Distribución geográfica |
| `vehiculo_propio` | boolean | Viajes en vehículo propio vs transporte |

#### Módulo Presupuestos
**Tablas:** `presupuestos` + `presupuesto_detalle`

| Campo | Uso analítico |
|---|---|
| `presupuestos.anio` | Análisis por ejercicio fiscal |
| `presupuestos.valor_total` | Presupuesto asignado total |
| `presupuestos.proyecto_id` | Presupuesto por proyecto |
| `presupuesto_detalle.categoria_gasto_id` | Presupuesto por categoría |
| `presupuesto_detalle.valor_presupuestado` | Monto presupuestado por línea |
| Calculado: gastado vs presupuesto | Variación presupuestaria |

#### Módulo Proyectos
**Tabla:** `proyectos` (18 columnas)

| Campo | Uso analítico |
|---|---|
| `valor_contrato` | Valor total del contrato |
| `presupuesto` | Presupuesto asignado al proyecto |
| `fecha_inicio` / `fecha_fin` | Duración del proyecto |
| `estado_proyecto_id` | Distribución por estado |
| `estado_financiero` | Estado financiero del proyecto |
| `cliente_id` | Análisis por cliente |
| `centro_costo_id` | Análisis por centro de costo |
| `sucursal_id` | Análisis por sucursal |
| `responsable_usuario_id` | Análisis por responsable |

#### Módulo Clientes
**Tabla:** `clientes` (14 columnas)

| Campo | Uso analítico |
|---|---|
| `meta_facturacion_anual` | Meta vs real facturado |
| `estado` | Clientes activos/inactivos |
| Calculado: rendiciones → proyectos → clientes | Gasto total por cliente |

#### Módulo Proveedores
**Tabla:** `proveedores` (13 columnas)

| Campo | Uso analítico |
|---|---|
| `ciudad` / `pais` | Distribución geográfica de proveedores |
| `estado` | Proveedores activos |
| Calculado: gastos → proveedores | Top proveedores por gasto |

#### Módulo Workflow
**Tablas:** `aprobaciones`, `historial_workflow`, `workflow_pasos`, `workflows_aprobacion`

| Campo | Uso analítico |
|---|---|
| `aprobaciones.fecha_accion` | Tiempo de respuesta por aprobador |
| `aprobaciones.accion_id` | Distribución aprobar/rechazar/devolver |
| `historial_workflow.evento` | Trazabilidad completa |
| `historial_workflow.created_at` - `rendicion.fecha_envio` | Tiempo total en workflow |
| `workflow_pasos.orden` | Identificar cuellos de botella por paso |

#### Módulo Políticas
**Tabla:** `politicas` (16 columnas)

| Campo | Uso analítico |
|---|---|
| `tope_almuerzo/cena/desayuno` | Cumplimiento de topes por categoría |
| `tope_hospedaje` | Gastos vs política de hospedaje |
| `tope_miscelaneo` | Gastos misceláneos vs tope |
| `valor_km` | Costo de viajes en vehículo propio |
| Calculado: gasto vs tope × días | % cumplimiento de política |

#### IA y Auditoría
**Tablas:** `auditorias_ia`, `auditoria`, `ocr_extracciones`

| Campo | Uso analítico |
|---|---|
| `auditorias_ia.score` | Score de riesgo por rendición |
| `auditorias_ia.nivel_riesgo_id` | Distribución bajo/medio/alto |
| `auditorias_ia.hallazgos` | JSON con hallazgos específicos |
| `ocr_extracciones.confianza` | Calidad del reconocimiento OCR |
| `auditoria.tabla/accion` | Log completo de operaciones |

#### Otros
- **`anticipos`**: análisis de anticipos por proyecto/rendición vs. liquidación
- **`tipos_cambio`**: normalización de moneda extranjera
- **`centros_costo`**: presupuesto vs. ejecución por centro
- **`sucursales`**: gastos y rendiciones por sucursal
- **`tags` / `rendicion_tags`**: clasificación flexible de rendiciones
- **`notificaciones`**: tasa de lectura, notificaciones no atendidas

### 1.2 Vistas SQL existentes

| Vista | Contenido |
|---|---|
| `vw_dashboard_ejecutivo` | Totales globales por empresa |
| `vw_dashboard_proyectos` | Presupuesto, gasto real, margen por proyecto |
| `vw_dashboard_clientes` | Gastos y proyectos por cliente |
| `vw_dashboard_proveedores` | Top proveedores por gasto |
| `vw_dashboard_ia` | Score promedio y total de auditorías IA |

### 1.3 RPCs existentes (reutilizables)

| RPC | Uso en reportes |
|---|---|
| `wf_paso_actual` | Estado actual del workflow en reportes operativos |
| `wf_mis_pendientes` | Bandeja pendientes en reportes de gestión |
| `mi_empresa_id` | Scoping multi-empresa automático |

---

## PASO 2 — Catálogo de KPIs {#paso-2}

### 2.1 KPIs Financieros

| Código | Indicador | Cálculo | Fuente |
|---|---|---|---|
| FIN-01 | Total ejecutado | `SUM(rendiciones.total_facturado)` WHERE estado=aprobada | `rendiciones` |
| FIN-02 | Total reembolsable | `SUM(rendiciones.total_reembolsable)` WHERE estado=aprobada | `rendiciones` |
| FIN-03 | Total aprobado mes actual | SUM WHERE fecha_aprobacion en mes | `rendiciones` |
| FIN-04 | Total rechazado | SUM WHERE estado=rechazada | `rendiciones` |
| FIN-05 | Total anticipos entregados | `SUM(anticipos.valor)` | `anticipos` |
| FIN-06 | Saldo pendiente de liquidación | SUM(anticipos) - SUM(rendiciones.total_anticipos) | `anticipos` + `rendiciones` |
| FIN-07 | Presupuesto total asignado | `SUM(presupuestos.valor_total)` WHERE activo=true | `presupuestos` |
| FIN-08 | Presupuesto ejecutado | SUM(gastos.valor_factura) agrupado por presupuesto | `gastos` + `presupuestos` |
| FIN-09 | Presupuesto disponible | FIN-07 - FIN-08 | Calculado |
| FIN-10 | % Ejecución presupuestaria | (FIN-08 / FIN-07) × 100 | Calculado |
| FIN-11 | Variación presupuestaria | FIN-08 - FIN-07 (negativo = superávit) | Calculado |
| FIN-12 | Gasto promedio por rendición | FIN-01 / COUNT(rendiciones) | Calculado |
| FIN-13 | Gasto promedio por usuario | FIN-01 / COUNT(DISTINCT usuario_id) | Calculado |
| FIN-14 | Gasto por categoría | SUM(gastos.valor_factura) GROUP BY categoría | `gastos` + `categorias_gasto` |
| FIN-15 | Variación vs período anterior | (actual - anterior) / anterior × 100 | Calculado |
| FIN-16 | Total en moneda extranjera | SUM(gastos) WHERE moneda_codigo ≠ empresa.moneda_base | `gastos` + `tipos_cambio` |
| FIN-17 | Ratio reembolsable/facturado | SUM(total_reembolsable) / SUM(total_facturado) | `rendiciones` |
| FIN-18 | Gasto por centro de costo | SUM gastos → rendiciones → proyectos → centro_costo | Cross-table |

### 2.2 KPIs Operativos

| Código | Indicador | Cálculo | Fuente |
|---|---|---|---|
| OPS-01 | Rendiciones pendientes | COUNT WHERE estado=enviada | `rendiciones` |
| OPS-02 | Rendiciones en revisión | COUNT WHERE estado=en_revision | `rendiciones` |
| OPS-03 | Rendiciones aprobadas mes | COUNT WHERE estado=aprobada AND mes=actual | `rendiciones` |
| OPS-04 | Rendiciones rechazadas mes | COUNT WHERE estado=rechazada AND mes=actual | `rendiciones` |
| OPS-05 | Tiempo promedio de envío | AVG(fecha_envio - created_at) | `rendiciones` |
| OPS-06 | Tiempo promedio de aprobación | AVG(fecha_aprobacion - fecha_envio) | `rendiciones` |
| OPS-07 | Tiempo ciclo completo | AVG(fecha_aprobacion - created_at) | `rendiciones` |
| OPS-08 | Rendiciones sin workflow | COUNT WHERE workflow_id IS NULL | `rendiciones` |
| OPS-09 | Gastos sin categoría | COUNT WHERE categoria_gasto_id IS NULL | `gastos` |
| OPS-10 | Documentos sin OCR | COUNT WHERE procesado=false | `documentos` |
| OPS-11 | Tasa de rechazo | COUNT(rechazadas) / COUNT(total) × 100 | `rendiciones` |
| OPS-12 | Rendiciones con saldo negativo | COUNT WHERE saldo < 0 | `rendiciones` |
| OPS-13 | Anticipos no liquidados | COUNT(anticipos) WHERE rendicion_id IS NULL | `anticipos` |
| OPS-14 | Gastos manuales vs OCR | COUNT(es_manual=true) / COUNT(*) × 100 | `gastos` |

### 2.3 KPIs de Viajes

| Código | Indicador | Cálculo | Fuente |
|---|---|---|---|
| VIA-01 | Total viajes período | COUNT(viajes) | `viajes` |
| VIA-02 | Viajes por mes | COUNT GROUP BY mes | `viajes` |
| VIA-03 | Viajes por destino | COUNT GROUP BY destino | `viajes` |
| VIA-04 | Viajes por país | COUNT GROUP BY pais_id | `viajes` + `paises` |
| VIA-05 | Viajes por proyecto | COUNT viajes → rendiciones → proyectos | Cross-table |
| VIA-06 | Viajes por usuario | COUNT viajes → rendiciones → usuario_id | Cross-table |
| VIA-07 | Duración promedio | AVG(fecha_fin - fecha_inicio) | `viajes` |
| VIA-08 | Kilómetros totales | SUM(distancia_km) | `viajes` |
| VIA-09 | Costo promedio por viaje | SUM(gastos) / COUNT(viajes distintos) | `gastos` + `viajes` |
| VIA-10 | Costo por km | SUM(gastos) / SUM(distancia_km) | `gastos` + `viajes` |
| VIA-11 | % Vehículo propio | COUNT(vehiculo_propio=true) / COUNT(*) | `viajes` |
| VIA-12 | Ahorro por política km | SUM(distancia_km × valor_km de política) | `viajes` + `politicas` |

### 2.4 KPIs de Workflow

| Código | Indicador | Cálculo | Fuente |
|---|---|---|---|
| WF-01 | Aprobaciones pendientes | COUNT aprobaciones en paso actual | `aprobaciones` via RPC |
| WF-02 | Aprobadas esta semana | COUNT WHERE accion=aprobar AND fecha_accion en semana | `aprobaciones` |
| WF-03 | Rechazadas esta semana | COUNT WHERE accion=rechazar | `aprobaciones` |
| WF-04 | Devueltas esta semana | COUNT WHERE accion=devolver | `aprobaciones` |
| WF-05 | Tiempo promedio por aprobador | AVG(fecha_accion - created_at) GROUP BY usuario_id | `aprobaciones` |
| WF-06 | Tiempo promedio por paso | AVG(fecha_accion - entrada_paso) GROUP BY workflow_paso_id | `aprobaciones` + `historial_workflow` |
| WF-07 | Cuello de botella | paso con MAX(tiempo promedio) | Calculado |
| WF-08 | Tasa de aprobación primera vez | COUNT(aprobadas directo) / COUNT(total) | `aprobaciones` |
| WF-09 | Rendiciones por aprobador | COUNT GROUP BY usuario_id en aprobaciones | `aprobaciones` |
| WF-10 | Workflows activos | COUNT(workflows_aprobacion WHERE activo=true) | `workflows_aprobacion` |

### 2.5 KPIs de Cumplimiento de Política

| Código | Indicador | Cálculo | Fuente |
|---|---|---|---|
| POL-01 | Gastos sobre tope almuerzo | COUNT/SUM gastos categoría=almuerzo WHERE valor > tope | `gastos` + `politicas` |
| POL-02 | Gastos sobre tope hospedaje | Ídem hospedaje | `gastos` + `politicas` |
| POL-03 | % cumplimiento por política | Gastos dentro de tope / total × 100 | Calculado |
| POL-04 | Ahorro por política | Tope × días vs. gasto real | `politicas` + `rendiciones` |
| POL-05 | Rendiciones sin política | COUNT WHERE politica_id IS NULL | `rendiciones` |

### 2.6 KPIs de IA y Riesgo

| Código | Indicador | Cálculo | Fuente |
|---|---|---|---|
| IA-01 | Score promedio de riesgo | AVG(rendiciones.score_auditoria) | `rendiciones` |
| IA-02 | Rendiciones de alto riesgo | COUNT WHERE score_auditoria > 75 | `rendiciones` |
| IA-03 | Score promedio IA | AVG(auditorias_ia.score) | `auditorias_ia` |
| IA-04 | Calidad OCR promedio | AVG(documentos.ocr_confianza) | `documentos` |
| IA-05 | Documentos con baja confianza | COUNT WHERE ocr_confianza < 0.7 | `documentos` |

---

## PASO 3 — Catálogo de Reportes {#paso-3}

### 3.1 Reportes Operativos

---

#### RPT-OPS-01: Rendiciones por Estado
**Objetivo:** Vista completa del estado actual de todas las rendiciones en el período.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período (fecha_rendicion), estado, tipo, proyecto, usuario, sucursal |
| **Columnas** | Número, Fecha, Usuario, Proyecto, Estado, Total Facturado, Reembolsable, Saldo, Días en estado |
| **Agrupación** | Por estado, por mes |
| **Totales** | Subtotal por estado; total general |
| **Exportaciones** | Excel, PDF, CSV |
| **Drill-down** | → Detalle de rendición con gastos |

---

#### RPT-OPS-02: Gastos Detallados
**Objetivo:** Registro completo de gastos con toda la información de categorización.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, categoría, proveedor, moneda, estado, origen (manual/OCR), rendición |
| **Columnas** | Fecha, Rendición, Proyecto, Categoría, Proveedor, N° Documento, Valor Factura, Valor Reembolsable, Moneda, Tipo Cambio, Valor Base |
| **Agrupación** | Por categoría, por proveedor, por mes, por rendición |
| **Totales** | Subtotal por agrupación; total general en moneda base |
| **Exportaciones** | Excel, PDF, CSV |
| **Drill-down** | → Detalle del gasto con documento OCR |

---

#### RPT-OPS-03: Viajes
**Objetivo:** Detalle de todos los viajes con gastos asociados.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, destino, país, proyecto, usuario, vehiculo_propio |
| **Columnas** | N°, Fechas, Destino, País, Usuario, Proyecto, Km, Días, Gastos Asociados, Costo Total |
| **Agrupación** | Por destino, por país, por mes, por proyecto |
| **Totales** | Km totales, días totales, costo total |
| **Exportaciones** | Excel, PDF |
| **Drill-down** | → Gastos del viaje |

---

#### RPT-OPS-04: Anticipos y Liquidaciones
**Objetivo:** Control de anticipos entregados vs liquidados en rendiciones.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, proyecto, usuario, estado (liquidado/pendiente) |
| **Columnas** | N° Anticipo, Fecha, Usuario, Proyecto, Monto, Rendición Asociada, Estado, Saldo |
| **Agrupación** | Por proyecto, por usuario |
| **Totales** | Total anticipos, total liquidado, saldo pendiente |
| **Exportaciones** | Excel, PDF |
| **Drill-down** | → Rendición de liquidación |

---

#### RPT-OPS-05: Documentos y OCR
**Objetivo:** Estado del procesamiento documental.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, estado OCR, categoría documento, rendición |
| **Columnas** | Archivo, Rendición, Tipo, Categoría, Procesado, Confianza OCR, Proveedor Detectado, Monto Detectado, Fecha |
| **Agrupación** | Por estado, por tipo, por rendición |
| **Totales** | % procesados, confianza promedio |
| **Exportaciones** | Excel |
| **Drill-down** | → Resultado de extracción OCR |

---

### 3.2 Reportes Financieros

---

#### RPT-FIN-01: Ejecución Presupuestaria
**Objetivo:** Comparativo presupuesto vs. ejecución real por proyecto y categoría.

| Atributo | Detalle |
|---|---|
| **Filtros** | Año, proyecto, categoría gasto, centro de costo |
| **Columnas** | Proyecto, Categoría, Presupuestado, Ejecutado, Diferencia, % Ejecución |
| **Agrupación** | Por proyecto, por categoría |
| **Totales** | Totales por proyecto; total empresa |
| **Alertas** | Highlight rojo si % > 90%; amarillo si > 75% |
| **Exportaciones** | Excel, PDF |
| **Drill-down** | → Gastos que componen la ejecución |

---

#### RPT-FIN-02: Evolución de Gastos
**Objetivo:** Serie temporal de gastos por mes con comparativo de períodos.

| Atributo | Detalle |
|---|---|
| **Filtros** | Año(s) a comparar, categoría, proyecto, usuario |
| **Columnas** | Mes, Facturado, Reembolsable, Variación vs mes anterior, Variación vs mismo mes año anterior |
| **Gráfico** | Línea multi-serie por año + barra de variación |
| **Agrupación** | Por mes |
| **Exportaciones** | Excel, PDF con gráfico |

---

#### RPT-FIN-03: Gastos por Categoría
**Objetivo:** Distribución de gasto por categoría con tendencia.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, proyecto, usuario, proveedor |
| **Columnas** | Categoría, Gastos N°, Total Facturado, Total Reembolsable, % del Total |
| **Gráfico** | Pie / Treemap de distribución |
| **Agrupación** | Por categoría |
| **Exportaciones** | Excel, PDF |
| **Drill-down** | → Gastos individuales de la categoría |

---

#### RPT-FIN-04: Análisis Multimoneda
**Objetivo:** Gastos en moneda extranjera con tipo de cambio aplicado.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, moneda, proyecto |
| **Columnas** | Fecha, Moneda Origen, Valor Original, Tipo Cambio, Valor Base, Variación TC |
| **Agrupación** | Por moneda, por mes |
| **Totales** | Total por moneda, total en moneda base |
| **Exportaciones** | Excel |

---

#### RPT-FIN-05: Presupuesto por Centro de Costo
**Objetivo:** Ejecución presupuestaria agrupada por centro de costo.

| Atributo | Detalle |
|---|---|
| **Filtros** | Año, centro de costo, sucursal |
| **Columnas** | Centro de Costo, Sucursal, Presupuesto, Ejecutado, Disponible, % Ejecución |
| **Agrupación** | Por centro, por sucursal |
| **Exportaciones** | Excel, PDF |

---

### 3.3 Reportes Gerenciales

---

#### RPT-GER-01: Resumen Ejecutivo
**Objetivo:** Vista de alto nivel para gerencia con KPIs más relevantes del período.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período |
| **Secciones** | KPIs financieros · Top proyectos · Top usuarios · Top proveedores · Alertas |
| **Formato** | Orientado a impresión/PDF, una página |
| **Exportaciones** | PDF (formato ejecutivo) |

---

#### RPT-GER-02: Rendimiento por Proyecto
**Objetivo:** Estado financiero de todos los proyectos activos.

| Atributo | Detalle |
|---|---|
| **Filtros** | Estado proyecto, cliente, responsable, período |
| **Columnas** | Proyecto, Cliente, Responsable, Valor Contrato, Presupuesto, Gasto Real, Margen, % Presupuesto, Rendiciones N°, Estado |
| **Agrupación** | Por cliente, por estado, por responsable |
| **Alertas** | Proyectos con margen negativo o presupuesto > 80% |
| **Exportaciones** | Excel, PDF |
| **Drill-down** | → Rendiciones del proyecto → Gastos |

---

#### RPT-GER-03: Rendimiento por Usuario/Viajero
**Objetivo:** Análisis del gasto por empleado con comparativos.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, rol, proyecto |
| **Columnas** | Usuario, Cargo, Rendiciones N°, Total Gastado, Reembolsable, Anticipos, Score IA Promedio, Viajes N° |
| **Agrupación** | Por departamento/cargo |
| **Exportaciones** | Excel |
| **Drill-down** | → Rendiciones del usuario |

---

#### RPT-GER-04: Análisis por Cliente
**Objetivo:** Gastos y rendiciones agrupados por cliente.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, estado cliente |
| **Columnas** | Cliente, RUC, Proyectos Activos, Total Rendiciones, Total Gastado, Meta Facturación, % Meta |
| **Agrupación** | Por estado |
| **Exportaciones** | Excel, PDF |
| **Drill-down** | → Proyectos del cliente → Rendiciones |

---

#### RPT-GER-05: Top Proveedores
**Objetivo:** Análisis de concentración de gasto en proveedores.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, país, ciudad, categoría gasto |
| **Columnas** | Proveedor, País, Ciudad, N° Gastos, Total Facturado, % del Total, Categorías Principales |
| **Agrupación** | Por país, por ciudad |
| **Exportaciones** | Excel, PDF |
| **Drill-down** | → Gastos con el proveedor |

---

### 3.4 Reportes de Auditoría

---

#### RPT-AUD-01: Trazabilidad de Rendiciones
**Objetivo:** Historial completo de eventos de una rendición para auditoría.

| Atributo | Detalle |
|---|---|
| **Filtros** | Rendición específica, usuario, período |
| **Columnas** | Fecha/Hora, Usuario, Evento, Detalle, IP |
| **Fuente** | `historial_workflow` + `auditoria` |
| **Exportaciones** | PDF, Excel |

---

#### RPT-AUD-02: Rendiciones de Alto Riesgo IA
**Objetivo:** Rendiciones flaggeadas por el motor de IA con mayor riesgo.

| Atributo | Detalle |
|---|---|
| **Filtros** | Score mínimo, período, usuario, proyecto |
| **Columnas** | Rendición, Usuario, Proyecto, Score, Nivel Riesgo, Hallazgos, Recomendaciones, Estado |
| **Agrupación** | Por nivel de riesgo |
| **Exportaciones** | Excel, PDF |
| **Drill-down** | → Detalle de hallazgos IA → Gastos |

---

#### RPT-AUD-03: Log de Operaciones del Sistema
**Objetivo:** Registro de todas las acciones realizadas sobre entidades críticas.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, tabla, acción (INSERT/UPDATE/DELETE), usuario |
| **Columnas** | Fecha, Usuario, Tabla, Acción, Registro ID, Valor Anterior, Valor Nuevo, IP |
| **Exportaciones** | Excel |

---

#### RPT-AUD-04: Cumplimiento de Políticas
**Objetivo:** Detalle de gastos que superan los topes establecidos por política.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, política, categoría, usuario |
| **Columnas** | Gasto, Rendición, Usuario, Categoría, Tope Política, Valor Gasto, Excedente, % Exceso |
| **Agrupación** | Por categoría, por usuario |
| **Totales** | Total excedente por categoría |
| **Exportaciones** | Excel, PDF |

---

### 3.5 Reportes de Workflow

---

#### RPT-WF-01: Estado de Aprobaciones
**Objetivo:** Visión completa del estado actual de todas las aprobaciones pendientes.

| Atributo | Detalle |
|---|---|
| **Filtros** | Aprobador, paso, workflow, días en espera |
| **Columnas** | Rendición, Usuario Solicitante, Aprobador Actual, Paso, Días en Espera, Total, Proyecto |
| **Alertas** | Highlight si días > umbral configurable |
| **Exportaciones** | Excel |

---

#### RPT-WF-02: Eficiencia del Workflow
**Objetivo:** Análisis de tiempos y tasas de aprobación por paso y aprobador.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, workflow, aprobador |
| **Columnas** | Aprobador, Paso, N° Acciones, Aprobar, Rechazar, Devolver, Tiempo Promedio (días), Tiempo Máximo |
| **Agrupación** | Por aprobador, por paso |
| **Exportaciones** | Excel |
| **Drill-down** | → Rendiciones procesadas |

---

#### RPT-WF-03: Historial de Acciones de Aprobación
**Objetivo:** Log completo de todas las acciones tomadas en el workflow.

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, aprobador, acción (aprobar/rechazar/devolver), rendición |
| **Columnas** | Fecha, Rendición, Aprobador, Paso, Acción, Comentario, Tiempo en Paso |
| **Exportaciones** | Excel |

---

### 3.6 Reportes de Administración

---

#### RPT-ADM-01: Usuarios Activos y Acceso
**Objetivo:** Control de acceso y actividad de usuarios.

| Atributo | Detalle |
|---|---|
| **Filtros** | Rol, estado, último acceso |
| **Columnas** | Usuario, Cargo, Rol, Empresa, Fecha Ingreso, Último Acceso, Rendiciones Creadas, Estado |
| **Exportaciones** | Excel |

---

#### RPT-ADM-02: Uso del Sistema por Módulo
**Objetivo:** Actividad en la tabla de auditoría desglosada por módulo (tabla).

| Atributo | Detalle |
|---|---|
| **Filtros** | Período, tabla, usuario |
| **Columnas** | Tabla/Módulo, Inserciones, Actualizaciones, Eliminaciones, Usuarios Únicos |
| **Exportaciones** | Excel |

---

## PASO 4 — Arquitectura BI {#paso-4}

### 4.1 Principio fundamental

La arquitectura BI **extiende** la arquitectura existente sin romperla:

```
Route /reportes/*
  └── Hook useReporte*(params)
        └── Service reportes*.ts  ←── NEW (solo lectura, nunca escribe)
              └── Vistas SQL / RPCs existentes / Queries directas
                    └── supabase client (solo .select(), .rpc())
```

**Regla de oro:** Los services de reportes son **read-only**. Nunca hacen INSERT/UPDATE/DELETE. El CRUD factory NO se usa en reportes (no tiene paginación analítica ni JOINs complejos).

### 4.2 Estructura de archivos nuevos

```
src/
├── routes/
│   └── reportes.tsx                  ← Thin route + shell de navegación
│
├── components/
│   └── reportes/
│       ├── reporte-shell.tsx         ← Layout común: filtros + tabla + export
│       ├── reporte-filtros.tsx       ← Barra de filtros global persistente
│       ├── reporte-tabla.tsx         ← DataTable extendida para reportes
│       ├── reporte-grafico.tsx       ← Wrapper Recharts para reportes
│       ├── reporte-export-bar.tsx    ← Botones Excel/PDF/CSV/Imprimir
│       ├── reporte-kpi-card.tsx      ← KPI card para header de reporte
│       │
│       ├── operativos/
│       │   ├── rpt-rendiciones-estado.tsx
│       │   ├── rpt-gastos-detalle.tsx
│       │   ├── rpt-viajes.tsx
│       │   ├── rpt-anticipos.tsx
│       │   └── rpt-documentos.tsx
│       │
│       ├── financieros/
│       │   ├── rpt-ejecucion-presupuestaria.tsx
│       │   ├── rpt-evolucion-gastos.tsx
│       │   ├── rpt-gastos-categoria.tsx
│       │   ├── rpt-multimoneda.tsx
│       │   └── rpt-centros-costo.tsx
│       │
│       ├── gerenciales/
│       │   ├── rpt-resumen-ejecutivo.tsx
│       │   ├── rpt-proyectos.tsx
│       │   ├── rpt-usuarios.tsx
│       │   ├── rpt-clientes.tsx
│       │   └── rpt-proveedores.tsx
│       │
│       ├── auditoria/
│       │   ├── rpt-trazabilidad.tsx
│       │   ├── rpt-riesgo-ia.tsx
│       │   ├── rpt-log-operaciones.tsx
│       │   └── rpt-cumplimiento-politicas.tsx
│       │
│       ├── workflow/
│       │   ├── rpt-estado-aprobaciones.tsx
│       │   ├── rpt-eficiencia-workflow.tsx
│       │   └── rpt-historial-aprobaciones.tsx
│       │
│       └── dashboard/
│           └── (ampliar los componentes existentes en components/dashboard/)
│
├── services/
│   ├── reportes-operativos.ts        ← Queries: rendiciones, gastos, viajes, anticipos
│   ├── reportes-financieros.ts       ← Queries: presupuesto vs ejecución, evolución, monedas
│   ├── reportes-gerenciales.ts       ← Queries: proyectos, usuarios, clientes, proveedores
│   ├── reportes-auditoria.ts         ← Queries: historial, IA, log, políticas
│   ├── reportes-workflow.ts          ← Queries: aprobaciones, eficiencia, tiempos
│   └── reportes-export.ts            ← Lógica de exportación Excel/PDF/CSV
│
├── hooks/
│   └── entities/
│       └── use-reportes.ts           ← Hooks React Query para todos los reportes
│
└── types/
    └── reportes.ts                   ← Tipos DTO de respuesta de reportes
```

### 4.3 Responsabilidades por capa

#### Routes (`src/routes/reportes.tsx`)
- Thin component: lee parámetros de URL (tipo de reporte activo, filtros en searchParams)
- Renderiza `ReporteShell` con el componente correcto según la sub-ruta
- **No contiene lógica de negocio**
- Gestiona el estado de navegación entre categorías y reportes

#### Hooks (`use-reportes.ts`)
- Un hook por reporte: `useRptRendicionesEstado(params)`, `useRptEjecucionPresupuestaria(params)`, etc.
- Parámetros tipados: `ReporteParams = { fechaDesde, fechaHasta, empresaId, ...filtros }`
- `staleTime` de 5 minutos para reportes operativos; 30 minutos para reportes de tendencia
- `enabled: !!empresaId && !!fechaDesde && !!fechaHasta`
- Paginación del lado cliente para exportaciones (fetch all + slice para display)

#### Services (`reportes-*.ts`)
- Funciones async puras: reciben params, devuelven datos tipados
- Solo usan `supabase.from(...).select(...)` y `supabase.rpc(...)`
- No usan el CRUD factory (las queries son demasiado específicas)
- Manejan JOINs complejos con PostgREST syntax: `select("*, proyectos(nombre), usuarios(nombres, apellidos)")`
- Devuelven arrays de objetos con tipos en `src/types/reportes.ts`

#### SQL Layer (vistas + RPCs)
- Ver PASO 4.4 para el diseño de nuevas vistas y RPCs
- Los services llaman a vistas y RPCs; no construyen SQL complejo en JS

### 4.4 Nuevas vistas y RPCs necesarias

#### Vistas SQL nuevas (VIEW, no MATERIALIZED)

```
vw_rpt_rendiciones_estado
  → rendiciones JOIN estados_rendicion JOIN proyectos JOIN usuarios
  → Columnas: id, numero, fecha_rendicion, fecha_envio, fecha_aprobacion,
              estado_codigo, estado_nombre, tipo_nombre, proyecto_nombre,
              usuario_nombre, total_facturado, total_reembolsable, saldo,
              dias_en_estado, score_auditoria, empresa_id

vw_rpt_gastos_detalle
  → gastos JOIN categorias_gasto JOIN proveedores JOIN monedas
           JOIN estados_gasto JOIN origenes_gasto
  → Columnas: id, fecha, rendicion_id, rendicion_numero, proyecto_id,
              proyecto_nombre, categoria_nombre, proveedor_nombre,
              valor_factura, valor_reembolsable, valor_moneda_base,
              moneda_codigo, numero_documento, es_manual, empresa_id

vw_rpt_ejecucion_presupuestaria
  → presupuestos JOIN presupuesto_detalle LEFT JOIN gastos JOIN proyectos
  → Columnas: presupuesto_id, proyecto_id, proyecto_nombre, categoria_id,
              categoria_nombre, anio, valor_presupuestado,
              SUM(gasto) AS ejecutado, valor_presupuestado - ejecutado AS disponible,
              ejecutado/valor_presupuestado AS pct_ejecucion, empresa_id

vw_rpt_viajes_detalle
  → viajes JOIN paises JOIN rendiciones JOIN usuarios JOIN proyectos
  → Columnas: id, numero, fecha_inicio, fecha_fin, destino, pais_nombre,
              distancia_km, vehiculo_propio,
              duracion_dias (fecha_fin - fecha_inicio),
              usuario_nombre, proyecto_nombre, rendicion_id, empresa_id

vw_rpt_aprobaciones_eficiencia
  → aprobaciones JOIN acciones_aprobacion JOIN workflow_pasos
                 JOIN workflows_aprobacion JOIN usuarios JOIN rendiciones
  → Columnas: aprobacion_id, rendicion_id, rendicion_numero,
              aprobador_id, aprobador_nombre, workflow_nombre,
              paso_nombre, paso_orden, accion_codigo,
              fecha_accion, empresa_id

vw_rpt_anticipos
  → anticipos JOIN proyectos JOIN usuarios JOIN rendiciones (LEFT)
  → Columnas: id, numero, fecha, valor, moneda_codigo,
              proyecto_nombre, usuario_id, usuario_nombre,
              rendicion_id, rendicion_numero, liquidado (rendicion_id IS NOT NULL),
              empresa_id

vw_rpt_cumplimiento_politicas
  → gastos JOIN rendiciones JOIN politicas JOIN categorias_gasto
  → Columnas: gasto_id, rendicion_numero, usuario_nombre, categoria_nombre,
              tope_politica (CASE WHEN categoria='almuerzo' THEN politica.tope_almuerzo ...),
              valor_gasto, excedente (GREATEST(valor_reembolsable - tope, 0)),
              empresa_id
```

#### RPCs nuevas

```sql
-- Reporte: evolución mensual de gastos (grupo por mes y año)
rpt_evolucion_mensual(p_empresa_id, p_anio_desde, p_anio_hasta, p_categoria_id?)
  → TABLE(anio, mes, label, facturado, reembolsable, var_mes_anterior, var_anio_anterior)

-- Reporte: tiempo de ciclo del workflow
rpt_tiempos_workflow(p_empresa_id, p_fecha_desde, p_fecha_hasta)
  → TABLE(rendicion_id, usuario_nombre, fecha_envio, fecha_primera_accion,
          fecha_aprobacion_final, horas_espera_total, paso_mas_lento, workflow_nombre)

-- Reporte: top proveedores con desglose por categoría
rpt_top_proveedores(p_empresa_id, p_fecha_desde, p_fecha_hasta, p_limite?)
  → TABLE(proveedor_id, nombre, pais, ciudad, n_gastos, total, pct_total, categoria_principal)

-- Reporte: resumen ejecutivo (single row aggregate + top lists)
rpt_resumen_ejecutivo(p_empresa_id, p_fecha_desde, p_fecha_hasta)
  → JSON (KPIs + top_proyectos + top_usuarios + alertas)

-- Reporte: cumplimiento de política con flag de exceso
rpt_cumplimiento_politicas(p_empresa_id, p_fecha_desde, p_fecha_hasta, p_politica_id?)
  → TABLE(...)
```

---

## PASO 5 — Modelo de Performance {#paso-5}

### 5.1 Clasificación de queries por tecnología

#### Views SQL simples (lectura frecuente, datos en tiempo real)
Usar cuando los datos deben ser actuales al instante y la query no es costosa.

| Reporte | Tecnología | Justificación |
|---|---|---|
| RPT-OPS-01 Rendiciones estado | VIEW | Datos en tiempo real, filtros variables |
| RPT-OPS-02 Gastos detalle | VIEW | Filtros ad-hoc, datos actuales |
| RPT-OPS-03 Viajes | VIEW | Pocos registros, tiempo real |
| RPT-OPS-04 Anticipos | VIEW | Datos actuales críticos |
| RPT-WF-01 Estado aprobaciones | RPC (existente) | Ya optimizado en `wf_mis_pendientes` |
| RPT-WF-03 Historial aprobaciones | VIEW | Filtros variables |
| RPT-AUD-01 Trazabilidad | VIEW | Consulta por rendición específica |
| RPT-AUD-03 Log operaciones | Tabla directa `auditoria` | Sin agregación |

#### RPCs (lógica compleja, múltiples fuentes, parámetros dinámicos)
Usar cuando hay cálculos complejos, múltiples tablas o lógica condicional.

| Reporte | Tecnología | Justificación |
|---|---|---|
| RPT-FIN-02 Evolución gastos | RPC | Agrupación temporal dinámica, variaciones interanuales |
| RPT-WF-02 Eficiencia workflow | RPC | Cálculo de tiempos entre eventos |
| RPT-GER-01 Resumen ejecutivo | RPC | Múltiples aggregates en una sola llamada |
| RPT-GER-05 Top proveedores | RPC | Rankings con % del total |
| RPT-ADM-01 Usuarios acceso | RPC | Join usuarios + empresas_usuarios + conteos |
| RPT-POL Cumplimiento políticas | RPC | Lógica CASE por categoría vs tope político |

#### Queries directas simples (sin vista ni RPC)
Usar para reportes simples sobre una tabla con filtros básicos.

| Reporte | Tecnología | Justificación |
|---|---|---|
| RPT-OPS-05 Documentos OCR | Tabla `documentos` | Query simple con filtros |
| RPT-FIN-04 Multimoneda | Tabla `gastos` + `tipos_cambio` | Join simple |
| RPT-AUD-02 Riesgo IA | Tabla `auditorias_ia` | Filtro por score/nivel |
| RPT-ADM-02 Uso por módulo | Tabla `auditoria` | GROUP BY tabla |

#### Materialized Views (datos costosos, toleran cierto delay)
Usar cuando el reporte es costoso, se consulta frecuentemente y puede tener 5-15 min de latencia.

| Vista Materializada | Refresh | Justificación |
|---|---|---|
| `mvw_ejecucion_presupuestaria` | Cada 15 min | JOIN presupuestos × gastos × proyectos es costoso |
| `mvw_top_proveedores_mes` | Cada hora | Ranking con % requiere WINDOW FUNCTIONS |
| `mvw_kpi_empresa_diario` | 1× por día | Snapshot diario para comparativos históricos |

### 5.2 Índices necesarios

```sql
-- Gastos: filtros más frecuentes en reportes
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(empresa_id, fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos(empresa_id, categoria_gasto_id, fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_proveedor ON gastos(empresa_id, proveedor_id);

-- Rendiciones: filtros por estado y período
CREATE INDEX IF NOT EXISTS idx_rendiciones_estado ON rendiciones(empresa_id, estado_rendicion_id);
CREATE INDEX IF NOT EXISTS idx_rendiciones_fecha ON rendiciones(empresa_id, fecha_rendicion);
CREATE INDEX IF NOT EXISTS idx_rendiciones_usuario ON rendiciones(empresa_id, usuario_id);
CREATE INDEX IF NOT EXISTS idx_rendiciones_proyecto ON rendiciones(empresa_id, proyecto_id);

-- Aprobaciones: análisis de workflow
CREATE INDEX IF NOT EXISTS idx_aprobaciones_usuario ON aprobaciones(empresa_id, usuario_id, fecha_accion);
CREATE INDEX IF NOT EXISTS idx_aprobaciones_rendicion ON aprobaciones(rendicion_id, fecha_accion);

-- Historial workflow
CREATE INDEX IF NOT EXISTS idx_historial_rendicion ON historial_workflow(rendicion_id, created_at);

-- Anticipos
CREATE INDEX IF NOT EXISTS idx_anticipos_proyecto ON anticipos(empresa_id, proyecto_id);

-- Auditoría IA
CREATE INDEX IF NOT EXISTS idx_auditorias_ia_score ON auditorias_ia(empresa_id, score);
```

### 5.3 Estrategia de caché React Query

| Tipo de reporte | staleTime | gcTime | Notas |
|---|---|---|---|
| KPIs del dashboard | 5 min | 30 min | Se actualizan frecuentemente |
| Reportes operativos | 5 min | 15 min | Estado actual, no histórico |
| Reportes financieros | 30 min | 60 min | Datos históricos, cambios lentos |
| Reportes gerenciales | 30 min | 60 min | Consultas costosas |
| Reportes de auditoría | 2 min | 10 min | Deben ser recientes |
| Reportes de workflow | 1 min | 5 min | Muy dinámicos |
| Materialized views | 15 min | 60 min | Latencia aceptada por diseño |

---

## PASO 6 — Dashboard Ejecutivo (Rediseño) {#paso-6}

### 6.1 Layout del Dashboard

El dashboard actual se **amplía** (no se reescribe). Se agregan secciones:

```
┌─────────────────────────────────────────────────────────────────┐
│  FILTROS GLOBALES: [Período ▼]  [Proyecto ▼]  [Sucursal ▼]    │
├─────────────────────────────────────────────────────────────────┤
│  KPI CARDS (fila 1 — datos de vw_dashboard_ejecutivo)          │
│  [Ejecutado] [Reembolsable] [Anticipos] [Presupuesto] [Score]  │
├────────────────────────┬────────────────────────────────────────┤
│  EVOLUCIÓN MENSUAL     │  EJECUCIÓN PRESUPUESTARIA             │
│  (gráfico línea 12m)   │  (gauge + barra por proyecto)         │
├────────────────────────┼────────────────────────────────────────┤
│  GASTOS POR CATEGORÍA  │  ALERTAS ACTIVAS                      │
│  (pie/treemap)         │  · Rendiciones pendientes > 5 días    │
│                        │  · Presupuestos > 80%                 │
│                        │  · Anticipos sin liquidar > 30 días   │
├────────────────────────┼────────────────────────────────────────┤
│  TOP PROYECTOS         │  TOP VIAJEROS                         │
│  (tabla + sparkline)   │  (tabla con avatares)                 │
├────────────────────────┼────────────────────────────────────────┤
│  TOP PROVEEDORES       │  WORKFLOW: PENDIENTES                 │
│  (tabla con %s)        │  (lista directa de mis pendientes)    │
├─────────────────────────────────────────────────────────────────┤
│  RENDICIONES RECIENTES (tabla con estado badge)                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 KPIs del Dashboard Ejecutivo

| KPI | Fuente | Comparativo |
|---|---|---|
| Total ejecutado | `vw_dashboard_ejecutivo.total_gastado` | vs mes anterior (%) |
| Total reembolsable | `vw_dashboard_ejecutivo.total_reembolsable` | vs mes anterior |
| Anticipos entregados | `vw_dashboard_ejecutivo.total_anticipos` | vs liquidados |
| Presupuesto total | `SUM(presupuestos.valor_total)` | % ejecutado |
| Score IA | `vw_dashboard_ia.score_promedio` | ↑ riesgo/↓ riesgo |
| Proyectos activos | `vw_dashboard_ejecutivo.total_proyectos_con_movimiento` | — |
| Usuarios activos | `vw_dashboard_ejecutivo.total_usuarios_con_movimiento` | — |

### 6.3 Alertas del Dashboard

Las alertas se calculan al cargar el dashboard y se muestran como badges en la barra superior y una sección de "Atención requerida":

| Alerta | Condición | Severidad |
|---|---|---|
| Rendiciones sin atender | Rendiciones en estado=enviada con fecha_envio > 5 días | ⚠️ Alta |
| Presupuesto casi agotado | vw_dashboard_proyectos.pct_ejecucion > 80% | ⚠️ Media |
| Anticipos sin liquidar | Anticipos WHERE rendicion_id IS NULL AND fecha < HOY-30 | ⚠️ Alta |
| Rendiciones de riesgo alto | score_auditoria > 75 AND estado ≠ aprobada | 🔴 Crítica |
| Documentos sin procesar | documentos WHERE procesado=false AND created_at < HOY-2 | ℹ️ Info |

### 6.4 Filtros globales del Dashboard

Los filtros se almacenan en `localStorage` como `viatik:dashboard:filtros` y persisten entre sesiones:

```
Período:  [Este mes ▼]  (opciones: semana, mes, trimestre, año, personalizado)
Proyecto: [Todos ▼]      (dropdown con proyectos activos de la empresa)
Sucursal: [Todas ▼]      (dropdown con sucursales)
```

### 6.5 Drill-down del Dashboard

```
KPI Total Ejecutado → click → Reporte RPT-FIN-02 (Evolución) pre-filtrado
Gráfico Categorías → click en sector → Reporte RPT-OPS-02 filtrado por categoría
Tabla Proyectos → click en fila → Reporte RPT-GER-02 del proyecto
Tabla Viajeros → click en fila → Reporte RPT-GER-03 del usuario
Tabla Proveedores → click en fila → Reporte RPT-GER-05 filtrado por proveedor
Alerta rendición → click → Detalle de rendición (rendicion-detail.tsx)
```

---

## PASO 7 — Exportaciones {#paso-7}

### 7.1 Librería recomendada

**SheetJS (xlsx)** para Excel — ya disponible en el stack (listado en las instrucciones del proyecto).  
**jsPDF + jspdf-autotable** para PDF — a instalar como dependencia nueva.  
**CSV** — generado desde JS puro, sin librería adicional.

### 7.2 Arquitectura del servicio de exportación

El service `reportes-export.ts` recibe los datos ya cargados por el hook y los convierte:

```
Hook → data (array de objetos tipados)
  → reportesExportService.toExcel(data, config)   → Blob → download
  → reportesExportService.toPDF(data, config)     → Blob → download
  → reportesExportService.toCSV(data, config)     → string → download
  → window.print()                                → native print
```

`config` define: título del reporte, columnas a incluir, formato de fechas/monedas, encabezado con logo/período/empresa.

### 7.3 Formatos por reporte

| Formato | Disponible en | Notas |
|---|---|---|
| **Excel (.xlsx)** | Todos los reportes | Multi-hoja: datos + resumen + gráficos |
| **PDF** | Gerenciales + Auditoría + Operativos | Orientación landscape, paginación automática |
| **CSV** | Todos los reportes | UTF-8 con BOM para compatibilidad Excel |
| **Imprimir** | Resumen ejecutivo + Rendición individual | CSS @media print incluido |

### 7.4 Funcionalidades de exportación Excel

- Fila de encabezado con empresa, período y fecha de generación
- Columnas con formato de celda: fechas como fecha, números como número, porcentajes como %
- Celda de totales con suma automática
- Formato condicional: rojo si presupuesto > 100%, verde si < 75%
- Hoja "Resumen" con KPIs principales + hoja "Detalle" con datos completos

### 7.5 Funcionalidades de exportación PDF

- Encabezado: logo Viatik + nombre empresa + período + fecha generación
- Tabla: columnas adaptadas a landscape, fuente reducida a 8pt
- Totales al pie de página en cada hoja
- Footer: número de página / total de páginas
- Filtros aplicados como metadata visible en el documento

---

## PASO 8 — UX y Navegación {#paso-8}

### 8.1 Estructura de navegación

```
/reportes                          ← Index: catálogo de reportes con tarjetas
/reportes/operativos/rendiciones   ← RPT-OPS-01
/reportes/operativos/gastos        ← RPT-OPS-02
/reportes/operativos/viajes        ← RPT-OPS-03
/reportes/operativos/anticipos     ← RPT-OPS-04
/reportes/operativos/documentos    ← RPT-OPS-05
/reportes/financieros/presupuesto  ← RPT-FIN-01
/reportes/financieros/evolucion    ← RPT-FIN-02
/reportes/financieros/categorias   ← RPT-FIN-03
/reportes/financieros/multimoneda  ← RPT-FIN-04
/reportes/financieros/centros      ← RPT-FIN-05
/reportes/gerenciales/ejecutivo    ← RPT-GER-01
/reportes/gerenciales/proyectos    ← RPT-GER-02
/reportes/gerenciales/usuarios     ← RPT-GER-03
/reportes/gerenciales/clientes     ← RPT-GER-04
/reportes/gerenciales/proveedores  ← RPT-GER-05
/reportes/auditoria/trazabilidad   ← RPT-AUD-01
/reportes/auditoria/riesgo-ia      ← RPT-AUD-02
/reportes/auditoria/log            ← RPT-AUD-03
/reportes/auditoria/politicas      ← RPT-AUD-04
/reportes/workflow/estado          ← RPT-WF-01
/reportes/workflow/eficiencia      ← RPT-WF-02
/reportes/workflow/historial       ← RPT-WF-03
/reportes/administracion/usuarios  ← RPT-ADM-01
/reportes/administracion/uso       ← RPT-ADM-02
```

El router de TanStack detecta el segmento activo para resaltar la categoría en el sidebar de reportes.

### 8.2 Layout de un reporte individual

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Reportes  >  Operativos  >  Rendiciones por Estado          │
│  Rendiciones por Estado                    [Exportar ▼] [⟳]   │
│  "Vista completa del estado actual..."                          │
├─────────────────────────────────────────────────────────────────┤
│  FILTROS: [Desde] [Hasta] [Estado ▼] [Proyecto ▼] [Usuario ▼]  │
│           [Tipo ▼]                         [Aplicar] [Limpiar]  │
├─────────────────────────────────────────────────────────────────┤
│  KPI MINI: [523 rendiciones] [$ 1.2M facturado] [87 pendientes]│
├─────────────────────────────────────────────────────────────────┤
│  TABLA (paginada):                                              │
│  N° | Fecha | Usuario | Proyecto | Estado | Facturado | Saldo  │
│  ── | ───── | ─────── | ──────── | ────── | ───────── | ───── │
│  ...                                                            │
│                                                [1 2 3 ... 12 →]│
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Persistencia de filtros

Los filtros de cada reporte se guardan en `localStorage` bajo la clave `viatik:reporte:{tipo}:filtros`:

```ts
// Ejemplo: viatik:reporte:rendiciones-estado:filtros
{
  fechaDesde: "2026-01-01",
  fechaHasta: "2026-06-30",
  estado: ["enviada", "aprobada"],
  proyectoId: null,
  usuarioId: null
}
```

Al navegar de vuelta al mismo reporte, se restauran los filtros automáticamente. Botón "Limpiar" resetea a defaults.

**Filtros globales** (período + proyecto + sucursal) afectan a todos los reportes y viven en `localStorage` bajo `viatik:filtros:globales`.

### 8.4 Estados de UI

| Estado | Componente | Comportamiento |
|---|---|---|
| **Loading** | `LoadingState` existente | Skeleton de tabla durante carga |
| **Empty** | `EmptyState` existente | "No hay datos para los filtros seleccionados" con botón Limpiar filtros |
| **Error** | `EmptyState` con tono error | Mensaje de error + botón Reintentar |
| **Sin permisos** | `EmptyState` | "No tienes acceso a este reporte" |
| **Exportando** | Spinner en botón | Botón deshabilitado durante generación |

### 8.5 Responsive

Los reportes se adaptan así:

| Viewport | Comportamiento |
|---|---|
| **Desktop (≥ 1280px)** | Layout completo: filtros en fila, tabla full width |
| **Tablet (768-1279px)** | Filtros en 2 columnas, tabla con scroll horizontal |
| **Mobile (< 768px)** | Filtros colapsados en drawer, tabla simplificada (columnas esenciales), exportar disponible |

Los gráficos usan `ResponsiveContainer` de Recharts (ya en el stack) con `aspect` ratio configurable.

---

## Plan de Implementación {#plan}

### FASE 8A — Infraestructura BI (Prioridad: ALTA)
**Duración estimada:** 2-3 sesiones  
**Dependencias:** Ninguna (no modifica código existente)

1. Migración SQL: crear las 7 vistas nuevas + 5 RPCs nuevas + 12 índices
2. Actualizar `database.ts` con tipos de las nuevas vistas y RPCs
3. Crear `src/types/reportes.ts` con todos los tipos DTO
4. Crear `src/services/reportes-operativos.ts` (funciones vacías tipadas)
5. Crear `src/services/reportes-financieros.ts`
6. Crear `src/services/reportes-gerenciales.ts`
7. Crear `src/services/reportes-auditoria.ts`
8. Crear `src/services/reportes-workflow.ts`
9. Crear `src/hooks/entities/use-reportes.ts`
10. TSC + lint

### FASE 8B — Shell y Navegación de Reportes (Prioridad: ALTA)
**Duración estimada:** 1-2 sesiones

1. Actualizar `src/routes/reportes.tsx` (de PagePlaceholder a shell real)
2. Crear `src/components/reportes/reporte-shell.tsx`
3. Crear `src/components/reportes/reporte-filtros.tsx`
4. Crear `src/components/reportes/reporte-tabla.tsx`
5. Crear `src/components/reportes/reporte-export-bar.tsx`
6. Registrar sub-rutas en `routeTree.gen.ts`
7. TSC + lint

### FASE 8C — Reportes Operativos (Prioridad: ALTA)
**Duración estimada:** 2-3 sesiones

1. RPT-OPS-01 Rendiciones por Estado
2. RPT-OPS-02 Gastos Detallados
3. RPT-OPS-03 Viajes
4. RPT-OPS-04 Anticipos y Liquidaciones
5. RPT-OPS-05 Documentos y OCR
6. TSC + lint

### FASE 8D — Reportes Financieros (Prioridad: ALTA)
**Duración estimada:** 2-3 sesiones

1. RPT-FIN-01 Ejecución Presupuestaria (con gráfico)
2. RPT-FIN-02 Evolución de Gastos (con gráfico multi-línea)
3. RPT-FIN-03 Gastos por Categoría (con pie chart)
4. RPT-FIN-04 Análisis Multimoneda
5. RPT-FIN-05 Presupuesto por Centro de Costo
6. TSC + lint

### FASE 8E — Reportes Gerenciales y Workflow (Prioridad: MEDIA)
**Duración estimada:** 2-3 sesiones

1. RPT-GER-01 Resumen Ejecutivo (optimizado para PDF)
2. RPT-GER-02 Rendimiento por Proyecto
3. RPT-GER-03 Rendimiento por Usuario
4. RPT-GER-04 Análisis por Cliente
5. RPT-GER-05 Top Proveedores
6. RPT-WF-01 Estado de Aprobaciones
7. RPT-WF-02 Eficiencia del Workflow
8. RPT-WF-03 Historial de Aprobaciones
9. TSC + lint

### FASE 8F — Reportes de Auditoría y Admin (Prioridad: MEDIA)
**Duración estimada:** 1-2 sesiones

1. RPT-AUD-01 Trazabilidad
2. RPT-AUD-02 Riesgo IA
3. RPT-AUD-03 Log de Operaciones
4. RPT-AUD-04 Cumplimiento de Políticas
5. RPT-ADM-01 Usuarios y Acceso
6. RPT-ADM-02 Uso del Sistema
7. TSC + lint

### FASE 8G — Exportaciones (Prioridad: MEDIA)
**Duración estimada:** 1-2 sesiones

1. Instalar dependencias: jsPDF + jspdf-autotable
2. Crear `src/services/reportes-export.ts`
3. Implementar exportación Excel (SheetJS)
4. Implementar exportación PDF
5. Implementar exportación CSV
6. Implementar modo impresión (CSS)
7. Integrar export-bar en todos los reportes
8. TSC + lint

### FASE 8H — Dashboard Ejecutivo Ampliado (Prioridad: MEDIA)
**Duración estimada:** 1-2 sesiones

1. Añadir alertas al dashboard (sección nueva)
2. Añadir filtros globales persistentes
3. Añadir KPI de presupuesto y score IA
4. Conectar drill-down de cards a reportes
5. Ampliar gráfico evolución con comparativo interanual
6. Materialized views + refresh automático
7. TSC + lint

### FASE 8I — Autoauditoría Final (Prioridad: ALTA al final)
1. TSC + lint completo
2. Verificar todos los drill-downs
3. Verificar persistencia de filtros
4. Verificar exportaciones
5. Autoauditoría FASE 8

---

## Mapa del Módulo BI

```
/reportes
    │
    ├── [OPERATIVOS] ─────────────────────────────────────────────┐
    │   ├── Rendiciones por Estado (vw_rpt_rendiciones_estado)    │
    │   ├── Gastos Detallados (vw_rpt_gastos_detalle)             │
    │   ├── Viajes (vw_rpt_viajes_detalle)                        │
    │   ├── Anticipos (vw_rpt_anticipos)                          │
    │   └── Documentos OCR (tabla documentos directa)            │
    │                                                             │
    ├── [FINANCIEROS] ────────────────────────────────────────────┤
    │   ├── Ejecución Presupuestaria (vw_rpt_ejecucion)           │
    │   ├── Evolución de Gastos (RPC rpt_evolucion_mensual)       │
    │   ├── Gastos por Categoría (query directa + agregación)     │
    │   ├── Análisis Multimoneda (gastos + tipos_cambio)          │
    │   └── Centros de Costo (centros_costo + gastos)             │
    │                                                             │
    ├── [GERENCIALES] ────────────────────────────────────────────┤
    │   ├── Resumen Ejecutivo (RPC rpt_resumen_ejecutivo)         │
    │   ├── Proyectos (vw_dashboard_proyectos ampliada)           │
    │   ├── Usuarios/Viajeros (join rendiciones + usuarios)       │
    │   ├── Clientes (vw_dashboard_clientes ampliada)             │
    │   └── Proveedores (RPC rpt_top_proveedores)                 │
    │                                                             │
    ├── [AUDITORÍA] ──────────────────────────────────────────────┤
    │   ├── Trazabilidad (historial_workflow + auditoria)         │
    │   ├── Riesgo IA (auditorias_ia + rendiciones)               │
    │   ├── Log Operaciones (tabla auditoria)                     │
    │   └── Cumplimiento Políticas (vw_rpt_cumplimiento)         │
    │                                                             │
    ├── [WORKFLOW] ───────────────────────────────────────────────┤
    │   ├── Estado Aprobaciones (RPC wf_mis_pendientes + ext.)    │
    │   ├── Eficiencia (RPC rpt_tiempos_workflow)                 │
    │   └── Historial (vw_rpt_aprobaciones_eficiencia)            │
    │                                                             │
    └── [ADMINISTRACIÓN] ─────────────────────────────────────────┘
        ├── Usuarios y Acceso (usuarios + empresas_usuarios)
        └── Uso del Sistema (tabla auditoria GROUP BY tabla)
```

---

*Documento generado en rama `feature/reportes`. No modifica código existente. Listo para iniciar implementación en FASE 8A.*
