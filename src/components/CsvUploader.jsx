import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet, FileText, UploadCloud, CheckCircle2,
  AlertTriangle, RefreshCw, Layers, Database
} from 'lucide-react';
import { mergeExtractedMetrics } from '../utils/dataMerger';
import { parseUploadedTabularFile, parseDelimitedText } from '../utils/fileParser';

export default function CsvUploader({ items, onDataExtracted, isLoading, setIsLoading }) {
  const [dragOver, setDragOver] = useState(false);
  const [successNotice, setSuccessNotice] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showTextPaste, setShowTextPaste] = useState(false);
  const [rawText, setRawText] = useState('');
  const fileInputRef = useRef(null);

  const handleStartUpload = async (file) => {
    if (!file) return;

    const fileName = (file.name || '').toLowerCase();
    const isTabular = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ||
                      fileName.endsWith('.csv') || fileName.endsWith('.tsv') || fileName.endsWith('.txt');

    if (!isTabular) {
      setErrorMsg('Por favor sube un archivo compatible con datos tabulares: CSV (.csv), TSV (.tsv) o Excel (.xlsx, .xls).');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const result = await parseUploadedTabularFile(file);

      if (!result.parsedItems || result.parsedItems.length === 0) {
        setErrorMsg(`No se detectaron filas con tiendas en "${file.name}". Revisa que el archivo contenga columnas como linea, tienda, mensajes o cantadas.`);
        setIsLoading(false);
        return;
      }

      applyParsedData(result.parsedItems, result.detectedType || 'BOTH', file.name);
    } catch (err) {
      console.error(err);
      setErrorMsg(`Error al procesar archivo: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const applyParsedData = (parsedItems, metricType, sourceName = '') => {
    const merged = mergeExtractedMetrics(items, parsedItems, metricType);
    onDataExtracted(merged);

    const dynamicCount = parsedItems.filter(it => it.isDynamic).length;
    let message = `✓ ${parsedItems.length} tiendas importadas desde "${sourceName}"`;
    if (dynamicCount > 0) {
      message += ` (${dynamicCount} tiendas nuevas añadidas automáticamente)`;
    }
    setSuccessNotice(message);
    setTimeout(() => setSuccessNotice(null), 6000);
  };

  const handleManualTextParse = () => {
    if (!rawText.trim()) return;
    try {
      const result = parseDelimitedText(rawText);
      if (result.parsedItems && result.parsedItems.length > 0) {
        applyParsedData(result.parsedItems, result.detectedType || 'BOTH', 'Texto Pegado');
        setShowTextPaste(false);
        setRawText('');
        setErrorMsg(null);
      } else {
        setErrorMsg('No se pudieron interpretar columnas válidas en el texto pegado.');
      }
    } catch (e) {
      setErrorMsg(`Error al procesar texto: ${e.message || e}`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleStartUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const activeStoresWithEff = items.filter(it => it.effectiveness && it.effectiveness > 0).length;
  const activeStoresWithMsgs = items.filter(it => it.currentMessages && it.currentMessages > 0).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Importar Datos (CSV o Excel)</h2>
            <p className="text-xs text-slate-400">Carga directa y consolidación horaria automática de tiendas</p>
          </div>
        </div>

        <button
          onClick={() => setShowTextPaste(!showTextPaste)}
          className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition"
        >
          <FileText className="w-3.5 h-3.5" />
          {showTextPaste ? 'Ocultar Texto' : 'Pegar texto CSV'}
        </button>
      </div>

      {/* Alerta de Éxito */}
      {successNotice && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span className="font-medium">{successNotice}</span>
        </div>
      )}

      {/* Alerta de Error */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-600/40 text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white font-bold text-sm">✕</button>
        </div>
      )}

      {/* Modal / Área de Pegado Manual */}
      {showTextPaste && (
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Pega el contenido delimitado por comas, punto y coma o tabulaciones:</span>
            <span className="text-[10px] text-slate-500">Auto-detecta columnas</span>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="fecha;hora;numero;linea;tienda;bpo;coordinador;producto;trafiker;estado;mensajes;cantadas&#10;2026-10-19;0;3002436644;OUTFIT FACTORY 2;ELT PIJAMAS;ELT;JORGE;PIJAMAS;Julio;ACTIVA;9;0"
            className="w-full h-24 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowTextPaste(false)}
              className="px-3 py-1 text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={handleManualTextParse}
              disabled={!rawText.trim()}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition"
            >
              Procesar Texto
            </button>
          </div>
        </div>
      )}

      {/* Zona Drag & Drop */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
          dragOver
            ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
            : 'border-slate-700 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-950/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleStartUpload(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />

        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-md">
          <UploadCloud className="w-6 h-6" />
        </div>

        <div>
          <p className="text-xs font-medium text-slate-200">
            Haz clic o arrastra tu archivo <strong className="text-emerald-400">CSV</strong> o <strong className="text-sky-400">Excel</strong> aquí
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Compatible con reportes horarios de WhatsApp, tracking de bots y resúmenes de Meta Ads
          </p>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
            .csv
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
            .xlsx / .xls
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
            delimitado por ; o ,
          </span>
        </div>
      </div>

      {/* Barra de Estado de Cartera */}
      <div className="flex items-center justify-between text-xs bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-slate-400">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>Tiendas en cartera: <strong className="text-slate-200">{items.length}</strong></span>
        </div>
        <div className="flex items-center gap-3">
          <span title="Tiendas con mensajes registrados">
            Mensajes: <strong className="text-sky-400">{activeStoresWithMsgs}</strong>
          </span>
          <span title="Tiendas con efectividad calculada mayor a 0%">
            Con Efectividad: <strong className="text-purple-400">{activeStoresWithEff}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
