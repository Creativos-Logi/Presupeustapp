# 🚀 Optimizador y Proyector de Presupuesto Publicitario (ROI & Efectividad)

Aplicación web interactiva para la **redistribución inteligente de presupuesto publicitario** a partir de capturas de pantalla de métricas de rendimiento (Costo por Mensaje y Efectividad %).

---

## 🎯 Características Principales

1. **Ingesta Directa desde Capturas de Pantalla**:
   - Soporte para pegado inmediato desde el portapapeles con <kbd>Ctrl + V</kbd> (ej. capturas con <kbd>Win + Shift + S</kbd>).
   - Arrastrar y soltar archivos de imagen.
   - Motor OCR integrado en el navegador (`Tesseract.js`) para extraer automáticamente tiendas, presupuestos, costo por mensaje y efectividad.
   - Opción para pegar datos tabulares directamente de Excel o Google Sheets.

2. **Algoritmo Anti-Trampa de Bajo Costo**:
   - **Problema**: Campañas con mensajes muy baratos pero casi nula efectividad de cierre consumen presupuesto sin generar ventas reales.
   - **Solución**: Un *Gatekeeper* algorítmico bloquea la inyección de presupuesto adicional a cualquier línea que esté por debajo del umbral mínimo de efectividad (configurable), reasignando los recursos hacia las líneas más rentables.

3. **Simulador de Proyección de Presupuesto (Alza y Baja)**:
   - Presets inmediatos: `-30%`, `-20%`, `-10%`, `Mismo (0%)`, `+10%`, `+20%`, `+30%`, `+50%`.
   - Entrada numérica de presupuesto total personalizado (\$ USD o moneda local).
   - Simulación en tiempo real de nuevos mensajes totales, mensajes efectivos y ROI proyectado.

4. **Visualizaciones & Gráficos**:
   - Gráfico de barras comparativo (Presupuesto Actual vs Nuevo Presupuesto).
   - Gráfico de mensajes proyectados.
   - Cuadrante de dispersión (Scatter Plot) de Rendimiento: Clasificación visual entre líneas estrella, trampas de volumen y líneas de calidad premium.

5. **Exportación & Productividad**:
   - Descarga directa en Excel estructurado (`.xlsx`).
   - Copiado rápido de la tabla al portapapeles para pegar directo en Meta Ads Manager o Google Ads.

---

## 🛠️ Cómo Iniciar la Aplicación

Para ejecutar la aplicación localmente en tu navegador:

```bash
# 1. En la carpeta del proyecto:
npm run dev
```

La aplicación se abrirá en `http://localhost:3000`.

---

## 🧪 Pruebas Automatizadas

Para ejecutar las pruebas del algoritmo matemático:

```bash
node test/optimizer.test.js
```
