import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud, Image, FileText, Loader2, Clipboard, CheckCircle2,
  AlertTriangle, DollarSign, Target, Sparkles, HelpCircle
} from 'lucide-react';
import { extractDataFromImage, parseTableText } from '../utils/ocrParser';
import { mergeExtractedMetrics } from '../utils/dataMerger';

export default function ImageUploader({ items, onDataExtracted, isLoading, setIsLoading }) {
  const [activeMetricType, setActiveMetricType] = useState('COST'); // 'COST', 'EFFECTIVENESS', 'BOTH'
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [showTypeModal, setShowTypeModal] = useState(false);

  const [dragOver, setDragOver] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [lastUploadedType, setLastUploadedType] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
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
            // Guardar imagen y abrir modal de confirmación de tipo
            setPendingImageFile(blob);
            setShowTypeModal(true);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleStartUpload = (file, explicitType = null) => {
    if (!file || !file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecciona un archivo de imagen válido (PNG, JPG, WebP).');
      return;
    }

    if (explicitType) {
      executeProcessing(file, explicitType);
    } else {
      // Preguntar qué métrica contiene
      setPendingImageFile(file);
      setShowTypeModal(true);
    }
  };

  const executeProcessing = async (file, metricType) => {
    setShowTypeModal(false);
    setPendingImageFile(null);
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
        setErrorMsg('No se detectaron datos válidos en la imagen. Puedes revisar los valores en la tabla manualmente.');
      } else {
        // Fusión inteligente con los datos existentes
        const merged = mergeExtractedMetrics(items, result.parsedItems, metricType);
        onDataExtracted(merged);
        setLastUploadedType(metricType);
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
    const parsed = parseTableText(rawText);
    if (parsed.length > 0) {
      const merged = mergeExtractedMetrics(items, parsed, metricType);
      onDataExtracted(merged);
      setShowTextPaste(false);
      setErrorMsg(null);
    } else {
      setErrorMsg('No se pudieron interpretar columnas numéricas del texto pegado.');
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
            <h2 className="text-sm font-semibold text-white">Cargar Capturas de Métricas</h2>
            <p className="text-xs text-slate-400">Soporta imágenes separadas de Costo y Efectividad</p>
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
          <span className="truncate">Captura Completa</span>
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

      {/* Zona de Drop & Clic */}
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
            ? 'border-emerald-500 bg-emerald-500/5'
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
          accept="image/*"
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
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              {activeMetricType === 'COST' ? (
                <DollarSign className="w-5 h-5 text-sky-400" />
              ) : activeMetricType === 'EFFECTIVENESS' ? (
                <Target className="w-5 h-5 text-purple-400" />
              ) : (
                <UploadCloud className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {activeMetricType === 'COST'
                  ? 'Pegar o subir Captura de Costo x Mensaje & Presupuesto'
                  : activeMetricType === 'EFFECTIVENESS'
                  ? 'Pegar o subir Captura de Efectividad (%)'
                  : 'Pegar o subir Captura Completa'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Presiona <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Ctrl + V</kbd> para pegar directamente la captura
              </p>
            </div>
          </>
        )}
      </div>

      {/* Opción de pegar texto alternativo */}
      {showTextPaste && (
        <div className="mt-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Pegar tabla de texto:
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Pega columnas aquí (ej. Nombre	Métrica)"
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

      {/* MODAL DE CONFIRMACIÓN AL PEGAR CON CTRL+V */}
      {showTypeModal && pendingImageFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">¿Qué métrica contiene esta captura?</h3>
                <p className="text-xs text-slate-400">Selecciona para fusionar los datos sin errores</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => executeProcessing(pendingImageFile, 'COST')}
                className="p-3.5 rounded-xl border border-sky-800/80 bg-sky-950/30 hover:bg-sky-900/40 text-left transition flex items-start gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-sky-300">Costo por Resultado / Mensajes</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Extrae presupuestos, costo x mensaje y mensajes generados (ej. Meta Ads Manager).
                  </p>
                </div>
              </button>

              <button
                onClick={() => executeProcessing(pendingImageFile, 'EFFECTIVENESS')}
                className="p-3.5 rounded-xl border border-purple-800/80 bg-purple-950/30 hover:bg-purple-900/40 text-left transition flex items-start gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-purple-300">Efectividad (%)</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Extrae la tasa de efectividad de cada tienda sin alterar los costos ya cargados.
                  </p>
                </div>
              </button>

              <button
                onClick={() => executeProcessing(pendingImageFile, 'BOTH')}
                className="p-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800/60 text-left transition flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-300">Captura Combinada (Ambas)</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    La imagen contiene tanto costo x mensaje como efectividad %.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => { setShowTypeModal(false); setPendingImageFile(null); }}
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
