import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud, Image, FileText, Loader2, Clipboard, CheckCircle2,
  AlertTriangle, DollarSign, Target, Sparkles, HelpCircle, FileSpreadsheet, Check
} from 'lucide-react';
import { extractDataFromImage, parseTableText } from '../utils/ocrParser';
import { mergeExtractedMetrics } from '../utils/dataMerger';
import { parseUploadedTabularFile, parseDelimitedText } from '../utils/fileParser';

export default function ImageUploader({ items, onDataExtracted, isLoading, setIsLoading }) {
  const [activeMetricType, setActiveMetricType] = useState('BOTH'); // 'BOTH' por defecto para auto-detección
  const [pendingFile, setPendingFile] = useState(null); // { file, isTabular, parsedResult }
  const [showTypeModal, setShowTypeModal] = useState(false);

  const [dragOver, setDragOver] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [lastUploadedType, setLastUploadedType] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);
  const [showTextPaste, setShowTextPaste] = useState(false);
  const [rawText, setRawText] = useState('');
  const fileInputRef = useRef(null);

  // Escuchar eventos globales de Pegar (Ctrl + V)
  useEffect(() => {
    const handlePaste = (e) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            setPendingFile({
              file: blob,
              isTabular: false,
              name: 'Captura de Portapapeles (Ctrl+V)'
            });
            setShowTypeModal(true);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleStartUpload = async (file, explicitType = null) => {
    if (!file) return;

    const fileName = (file.name || '').toLowerCase();
    const isTabular = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ||
                      fileName.endsWith('.csv') || fileName.endsWith('.tsv') || fileName.endsWith('.txt');
    const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(fileName);

    if (!isTabular && !isImage) {
      setErrorMsg('Por favor selecciona un archivo compatible: Excel (.xlsx, .xls), CSV (.csv) o Imagen (PNG, JPG, WebP).');
      return;
    }

    if (isTabular) {
      // 1. Procesamiento instantáneo de archivo tabular (Excel o CSV)
      setErrorMsg(null);
      setIsLoading(true);
      setProgressMsg(`Leyendo ${file.name}...`);
      setProgressPct(40);

      try {
        const result = await parseUploadedTabularFile(file);
        setProgressPct(100);

        if (!result.parsedItems || result.parsedItems.length === 0) {
          setErrorMsg(`No se detectaron filas con tiendas en "${file.name}". Revisa los encabezados del archivo.`);
          setIsLoading(false);
          return;
        }

        // Si el archivo tiene un tipo auto-detectado específico (ej. sólo COST o sólo EFFECTIVENESS), respetarlo
        const suggestedType = result.detectedType || explicitType || 'BOTH';

        // Aplicar directamente con el tipo detectado
        applyParsedData(result.parsedItems, suggestedType, file.name);
      } catch (err) {
        console.error(err);
        setErrorMsg(`Error al procesar archivo: ${err.message || err}`);
      } finally {
        setIsLoading(false);
      }
    } else {
      // 2. Procesamiento de imagen con OCR
      if (explicitType) {
        executeImageProcessing(file, explicitType);
      } else {
        setPendingFile({
          file,
          isTabular: false,
          name: file.name
        });
        setShowTypeModal(true);
      }
    }
  };

  const applyParsedData = (parsedItems, metricType, fileName = '') => {
    const merged = mergeExtractedMetrics(items, parsedItems, metricType);
    onDataExtracted(merged);
    setLastUploadedType(metricType);
    setSuccessNotice(`✓ ${parsedItems.length} tiendas importadas desde "${fileName}" (${metricType === 'COST' ? 'Costos' : metricType === 'EFFECTIVENESS' ? 'Efectividad' : 'Costos & Efectividad'})`);
    setTimeout(() => setSuccessNotice(null), 5000);
  };

  const executeImageProcessing = async (file, metricType) => {
    setShowTypeModal(false);
    setPendingFile(null);
    setErrorMsg(null);
    setIsLoading(true);

    const typeLabels = {
      COST: 'Costo por Resultado & Presupuesto',
      EFFECTIVENESS: 'Efectividad (%)',
      BOTH: 'Ambas Métricas'
    };

    setProgressMsg(`Iniciando OCR para [${typeLabels[metricType]}]...`);
    setProgressPct(10);

    try {
      const result = await extractDataFromImage(file, ({ status, progress }) => {
        setProgressMsg(status);
        setProgressPct(Math.round(progress * 100));
      });

      if (result.parsedItems.length === 0) {
        setErrorMsg('No se detectaron datos legibles en la imagen. Intenta con un archivo CSV, Excel o sube una imagen más nítida.');
      } else {
        applyParsedData(result.parsedItems, metricType, file.name || 'Captura OCR');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al procesar la imagen con OCR: ' + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualTextParse = (metricType) => {
    if (!rawText.trim()) return;
    const result = parseDelimitedText(rawText);
    if (result.parsedItems && result.parsedItems.length > 0) {
      applyParsedData(result.parsedItems, metricType, 'Texto Pegado');
      setShowTextPaste(false);
      setErrorMsg(null);
    } else {
      setErrorMsg('No se pudieron interpretar columnas válidas en el texto pegado.');
    }
  };

  const handleModalConfirm = (selectedMetricType) => {
    if (!pendingFile) return;

    if (pendingFile.isTabular && pendingFile.result) {
      setShowTypeModal(false);
      applyParsedData(pendingFile.result.parsedItems, selectedMetricType, pendingFile.name);
      setPendingFile(null);
    } else if (pendingFile.file) {
      executeImageProcessing(pendingFile.file, selectedMetricType);
    }
  };

  // Contar cuántas tiendas tienen costo y cuántas tienen efectividad cargada
  const storesWithCost = items.filter(it => it.costPerMessage && it.costPerMessage > 0).length;
  const storesWithEff = items.filter(it => it.effectiveness && it.effectiveness > 0).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
      {/* Encabezado con selector de modo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Importar Datos (Excel, CSV o Capturas)</h2>
            <p className="text-xs text-slate-400">Lectura nativa de archivos .xlsx / .csv y capturas OCR</p>
          </div>
        </div>

        <button
          onClick={() => setShowTextPaste(!showTextPaste)}
          className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition"
        >
          <FileText className="w-3.5 h-3.5" />
          {showTextPaste ? 'Ocultar Texto' : 'Pegar texto / CSV'}
        </button>
      </div>

      {/* Selector de tipo de captura activa */}
      <div className="grid grid-cols-3 gap-2 p-1.5 rounded-xl bg-slate-950 border border-slate-800">
        <button
          onClick={() => setActiveMetricType('COST')}
          className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
            activeMetricType === 'COST'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">1. Costo x Mensaje</span>
        </button>

        <button
          onClick={() => setActiveMetricType('EFFECTIVENESS')}
          className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
            activeMetricType === 'EFFECTIVENESS'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Target className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">2. Efectividad (%)</span>
        </button>

        <button
          onClick={() => setActiveMetricType('BOTH')}
          className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
            activeMetricType === 'BOTH'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Archivo Completo</span>
        </button>
      </div>

      {/* Indicadores de estado de cada métrica */}
      <div className="flex items-center justify-between px-1 text-[11px] font-mono">
        <span className="flex items-center gap-1 text-slate-400">
          <DollarSign className="w-3 h-3 text-sky-400" />
          Costos detectados: <strong className="text-sky-400">{storesWithCost} tiendas</strong>
        </span>
        <span className="flex items-center gap-1 text-slate-400">
          <Target className="w-3 h-3 text-purple-400" />
          Efectividades detectadas: <strong className="text-purple-400">{storesWithEff} tiendas</strong>
        </span>
      </div>

      {/* Zona de Drop & Clic para Excel, CSV e Imágenes */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.[0]) {
            handleStartUpload(e.dataTransfer.files[0], activeMetricType);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 min-h-[140px] ${
          dragOver
            ? 'border-emerald-500 bg-emerald-500/10'
            : activeMetricType === 'COST'
            ? 'border-sky-800/80 hover:border-sky-600 bg-sky-950/20'
            : activeMetricType === 'EFFECTIVENESS'
            ? 'border-purple-800/80 hover:border-purple-600 bg-purple-950/20'
            : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,.txt,image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleStartUpload(e.target.files[0], activeMetricType)}
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-2 w-full max-w-xs">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-xs font-medium text-slate-300">{progressMsg}</p>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-500">{progressPct}%</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400" title="Excel (.xlsx, .xls)">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 text-sky-400" title="CSV (.csv)">
                <FileText className="w-4 h-4" />
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400" title="Captura de imagen">
                <Image className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">
                Arrastra aquí tu archivo <strong className="text-emerald-400">Excel (.xlsx)</strong>, <strong className="text-sky-400">CSV</strong> o <strong className="text-purple-400">Captura</strong>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                O presiona <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Ctrl + V</kbd> para pegar directamente la captura
              </p>
            </div>
          </>
        )}
      </div>

      {/* Notificación de éxito */}
      {successNotice && (
        <div className="p-2.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-center gap-2 text-xs text-emerald-300 animate-fade-in font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Opción de pegar texto alternativo */}
      {showTextPaste && (
        <div className="mt-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Pegar tabla de texto o CSV copiado:
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Pega columnas separadas por comas, punto y coma o tabulación aquí..."
            rows={3}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => handleManualTextParse(activeMetricType)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1"
            >
              <Clipboard className="w-3.5 h-3.5" />
              Procesar como {activeMetricType === 'COST' ? 'Costos' : activeMetricType === 'EFFECTIVENESS' ? 'Efectividad' : 'Ambas'}
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-start gap-2 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ARCHIVO O CAPTURA */}
      {showTypeModal && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                {pendingFile.isTabular ? <FileSpreadsheet className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {pendingFile.isTabular ? 'Archivo detectado' : 'Captura detectada'}
                </h3>
                <p className="text-xs text-slate-400 font-mono truncate max-w-[280px]">
                  {pendingFile.name}
                </p>
                {pendingFile.result && (
                  <span className="text-[11px] text-emerald-400 font-medium">
                    ✓ {pendingFile.result.parsedItems.length} tiendas detectadas
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-300">
              ¿Qué métrica deseas actualizar con este archivo?
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => handleModalConfirm('COST')}
                className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 group ${
                  pendingFile.suggestedType === 'COST'
                    ? 'border-sky-500 bg-sky-950/40 shadow-sm'
                    : 'border-sky-800/80 bg-sky-950/20 hover:bg-sky-900/30'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-sky-300">Costo por Resultado / Mensajes</h4>
                    {pendingFile.suggestedType === 'COST' && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-sky-500/20 text-sky-300 font-semibold">Sugerido</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Actualiza presupuestos, costos por mensaje y volumen sin tocar la efectividad existente.
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleModalConfirm('EFFECTIVENESS')}
                className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 group ${
                  pendingFile.suggestedType === 'EFFECTIVENESS'
                    ? 'border-purple-500 bg-purple-950/40 shadow-sm'
                    : 'border-purple-800/80 bg-purple-950/20 hover:bg-purple-900/30'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-purple-300">Efectividad (%)</h4>
                    {pendingFile.suggestedType === 'EFFECTIVENESS' && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-500/20 text-purple-300 font-semibold">Sugerido</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Actualiza los porcentajes de efectividad sin alterar presupuestos ni costos actuales.
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleModalConfirm('BOTH')}
                className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                  pendingFile.suggestedType === 'BOTH'
                    ? 'border-emerald-500 bg-emerald-950/40 shadow-sm'
                    : 'border-slate-800 bg-slate-950 hover:bg-slate-800/60'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-emerald-300">Ambas Métricas (Completo)</h4>
                    {pendingFile.suggestedType === 'BOTH' && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold">Sugerido</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Actualiza tanto costos como efectividad detectados en el archivo.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => { setShowTypeModal(false); setPendingFile(null); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
