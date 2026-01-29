import { useState, useEffect, useRef, useMemo } from 'react'; // 👈 Agregamos useMemo
import { supabase } from '../supabase';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf'; 

import LogoUCM from './logo-ucm.png'
import LogoPMC from './logo_pmc.png'

// --- 🛡️ CONFIGURACIÓN SEGURA DE LOGOS ---
const LOGO_UCM_URL = LogoUCM; 
const LOGO_CARRERA_URL = LogoPMC; 

const BLOQUES = ['08:30 - 09:30', '09:35 - 10:35', '10:50 - 11:50', '11:55 - 12:55', '13:10 - 14:10', '14:30 - 15:30', '15:35 - 16:35', '16:50 - 17:50', '17:55 - 18:55', '19:00 - 20:00'];
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ==========================================
// 1. COMPONENTE EXTRAÍDO (FUERA DE GESTOR)
// ==========================================
function BuscadorRamos({ catalogo, valor, onChange, modoOscuro }) {
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);
  const wrapperRef = useRef(null);

  // ✅ CORRECCIÓN 1: Memoizamos la lista para que sea una dependencia estable
  const listaRamos = useMemo(() => {
    return Array.isArray(catalogo) ? catalogo : [];
  }, [catalogo]);

  // Click outside para cerrar
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ CORRECCIÓN 2: Sincronización segura del estado
  // Solo actualizamos el texto si el valor externo (ID) cambia y es diferente a lo que tenemos
  useEffect(() => {
    if (!valor) {
        // Si borraron el valor externo, limpiamos el input solo si no está vacío ya
        setBusqueda((prev) => prev === '' ? prev : '');
        return;
    }

    const ramoEncontrado = listaRamos.find(r => r.id === valor);
    if (ramoEncontrado) {
        // Solo actualizamos si el nombre es diferente para evitar loops
        setBusqueda((prev) => prev !== ramoEncontrado.nombre ? ramoEncontrado.nombre : prev);
    }
  }, [valor, listaRamos]); // listaRamos ahora es estable gracias a useMemo

  // Filtrado optimizado
  const filtrados = useMemo(() => {
    if (!busqueda) return [];
    return listaRamos.filter(r => 
      (r.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) || 
      (r.id || '').toLowerCase().includes(busqueda.toLowerCase())
    ).sort((a,b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [listaRamos, busqueda]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
      <input
        type="text"
        placeholder="🔍 Escribe para buscar..."
        value={busqueda}
        onFocus={() => { setAbierto(true); if(!valor) setBusqueda(''); }} // Limpiar al enfocar si no hay selección
        onChange={(e) => { 
            setBusqueda(e.target.value); 
            setAbierto(true); 
            if(e.target.value === '') onChange(''); // Si borra todo, limpiar selección
        }}
        style={{
          width: '100%', padding: '10px', borderRadius: '6px',
          border: '1px solid #ccc', outline: 'none',
          backgroundColor: modoOscuro ? '#1a202c' : 'white',
          color: modoOscuro ? '#e2e8f0' : '#2d3748',
          fontWeight: 'bold'
        }}
      />
      {abierto && busqueda && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          maxHeight: '250px', overflowY: 'auto',
          backgroundColor: modoOscuro ? '#2d3748' : 'white',
          border: '1px solid #ccc', borderRadius: '6px',
          zIndex: 9999, listStyle: 'none', padding: 0, margin: '5px 0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          {filtrados.length > 0 ? filtrados.map(r => (
            <li
              key={r.id}
              onClick={() => { onChange(r.id); setBusqueda(r.nombre); setAbierto(false); }}
              style={{
                padding: '10px', cursor: 'pointer',
                borderBottom: `1px solid ${modoOscuro ? '#4a5568' : '#eee'}`,
                color: modoOscuro ? '#e2e8f0' : '#2d3748',
                fontSize: '0.9rem'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = modoOscuro ? '#4a5568' : '#f7fafc'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <strong>{r.nombre}</strong> <span style={{fontSize:'0.8em', opacity: 0.7}}>({r.id})</span>
            </li>
          )) : (
            <li style={{ padding: '10px', color: '#718096', textAlign: 'center' }}>No se encontraron ramos</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ==========================================
// 2. COMPONENTE PRINCIPAL
// ==========================================
export function GestorHorarios({ catalogo = [], modoOscuro }) {
  const [semestreGestion, setSemestreGestion] = useState('2026-1');
  const [nivelSeleccionado, setNivelSeleccionado] = useState(1); 
  const [ofertaActual, setOfertaActual] = useState([]);
  const [ramoAProgramar, setRamoAProgramar] = useState('');
  
  // SELECCIÓN MÚLTIPLE
  const [bloquesSeleccionados, setBloquesSeleccionados] = useState([]); 

  // Modal de Edición Masiva
  const [modalAbierto, setModalAbierto] = useState(false);
  const [salaEdicion, setSalaEdicion] = useState('');
  const [atemporalEdicion, setAtemporalEdicion] = useState(false);

  // Protección de catálogo
  const listaCatalogo = useMemo(() => Array.isArray(catalogo) ? catalogo : [], [catalogo]);

  // --- CARGAR OFERTA ---
  useEffect(() => {
    cargarOferta();
  }, [semestreGestion]);

  const cargarOferta = async () => {
    try {
      if(!supabase) throw new Error("Cliente Supabase no inicializado");
      const { data, error } = await supabase.from('oferta_academica').select('*').eq('semestre_anio', semestreGestion);
      if(error) throw error;
      setOfertaActual(data || []);
      setBloquesSeleccionados([]); 
    } catch (err) {
      console.error("Error cargando oferta:", err);
    }
  };

  // --- FILTROS SEGUROS ---
  const getOfertaPorNivel = (nivel) => {
    return ofertaActual.filter(oferta => {
      const ramo = listaCatalogo.find(r => r.id === oferta.ramo_id);
      return ramo && ramo.nivel === nivel;
    });
  };

  const ofertaVisual = useMemo(() => {
      return nivelSeleccionado === 'Todos' 
        ? ofertaActual 
        : ofertaActual.filter(o => listaCatalogo.find(r => r.id === o.ramo_id)?.nivel === nivelSeleccionado);
  }, [nivelSeleccionado, ofertaActual, listaCatalogo]);

  // --- ACCIONES ---
  const handleCeldaClick = async (dia, bloque) => {
    if (!ramoAProgramar) return alert("⚠️ Selecciona un ramo arriba primero.");
    const ramoObj = listaCatalogo.find(r => r.id === ramoAProgramar);
    
    if (ramoObj && nivelSeleccionado !== 'Todos' && ramoObj.nivel !== nivelSeleccionado) {
       if(!window.confirm(`⚠️ Estás en Año ${nivelSeleccionado} pero el ramo es de Año ${ramoObj.nivel}. ¿Agregar?`)) return;
    }

    const { error } = await supabase.from('oferta_academica').insert({
      ramo_id: ramoAProgramar, dia, bloque, sala: '', es_atemporal: false, semestre_anio: semestreGestion
    });
    if (!error) cargarOferta(); else alert("Error: " + error.message);
  };

  // SELECCIÓN AL HACER CLIC
  const toggleSeleccionBloque = (e, idOferta) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (bloquesSeleccionados.includes(idOferta)) {
      setBloquesSeleccionados(prev => prev.filter(id => id !== idOferta));
    } else {
      setBloquesSeleccionados(prev => [...prev, idOferta]);
    }
  };

  const abrirEdicionMasiva = () => {
    if(bloquesSeleccionados.length === 0) return;
    setSalaEdicion(''); 
    setAtemporalEdicion(false);
    setModalAbierto(true);
  };

  const guardarEdicionMasiva = async () => {
    const { error } = await supabase.from('oferta_academica')
      .update({ sala: salaEdicion, es_atemporal: atemporalEdicion })
      .in('id', bloquesSeleccionados); 

    if (!error) {
      setModalAbierto(false);
      setBloquesSeleccionados([]); 
      cargarOferta();
    } else alert("Error al actualizar");
  };

  const borrarSeleccionados = async () => {
    if (!window.confirm(`¿Eliminar ${bloquesSeleccionados.length} bloques seleccionados?`)) return;
    await supabase.from('oferta_academica').delete().in('id', bloquesSeleccionados);
    setBloquesSeleccionados([]);
    cargarOferta();
  };

  // --- DESCARGAS (PDF) ---
  const generarPDF = async (tipo) => {
    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const niveles = tipo === 'single' ? [nivelSeleccionado === 'Todos' ? 1 : nivelSeleccionado] : [1, 2, 3, 4, 5];

      for (let i = 0; i < niveles.length; i++) {
        const nivel = niveles[i];
        const el = document.getElementById(`pdf-export-nivel-${nivel}`);
        if (el) {
          if (i > 0) pdf.addPage();
          const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
          const imgData = canvas.toDataURL('image/png');
          const imgProps = pdf.getImageProperties(imgData);
          const pdfHeight = (imgProps.height * pageWidth) / imgProps.width;
          let finalHeight = pdfHeight;
          if (finalHeight > pageHeight) finalHeight = pageHeight - 10;
          pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, finalHeight);
        }
      }
      pdf.save(`Horarios_${semestreGestion}.pdf`);
    } catch(err) {
      console.error(err);
      alert("Error al generar PDF. Verifique consola.");
    }
  };

  // --- UTILIDADES ---
  const getBloquesEnCelda = (list, dia, bloque) => list.filter(o => o.dia === dia && o.bloque === bloque);
  const getNombreRamo = (id) => listaCatalogo.find(c => c.id === id)?.nombre || id;
  const bordeColor = modoOscuro ? '#4a5568' : '#cbd5e0';
  const headerBg = modoOscuro ? '#1a202c' : '#f7fafc';
  const cellHover = modoOscuro ? '#2d3748' : '#edf2f7';
  const textoColor = modoOscuro ? '#e2e8f0' : '#2d3748';

  // --- RENDERIZADO ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', minHeight: '100%', flex: 1, position: 'relative' }}>
      
      <style>{`
        .custom-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: ${modoOscuro ? '#2d3748' : '#f1f1f1'}; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: ${modoOscuro ? '#4a5568' : '#ccc'}; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: ${modoOscuro ? '#718096' : '#aaa'}; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {/* 1. BARRA SUPERIOR */}
      <div style={{ padding: '15px', backgroundColor: modoOscuro ? '#2d3748' : 'white', borderRadius: '8px', display: 'flex', gap: '20px', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', flexWrap: 'wrap', borderLeft: '4px solid #3182ce' }}>
         <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
           <span style={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>📅 Semestre:</span>
           <input type="text" value={semestreGestion} onChange={(e) => setSemestreGestion(e.target.value)} style={{padding: '10px', borderRadius: '6px', width: '90px', border: '1px solid #ccc', textAlign: 'center', fontWeight: 'bold', backgroundColor: modoOscuro ? '#1a202c' : 'white', color: textoColor}} />
         </div>
         <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: '10px', minWidth: '300px'}}>
           <span style={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>📚 Asignatura:</span>
           {/* Componente extraído */}
           <BuscadorRamos catalogo={listaCatalogo} valor={ramoAProgramar} onChange={setRamoAProgramar} modoOscuro={modoOscuro} />
         </div>
      </div>

      {/* 2. PESTAÑAS + BOTONES PDF */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto' }}>
          {[1, 2, 3, 4, 5].map(nivel => (
            <button key={nivel} onClick={() => setNivelSeleccionado(nivel)} style={{ padding: '8px 20px', borderRadius: '6px 6px 0 0', border: 'none', backgroundColor: nivelSeleccionado === nivel ? (modoOscuro ? '#4a5568' : '#3182ce') : (modoOscuro ? '#2d3748' : '#e2e8f0'), color: nivelSeleccionado === nivel ? 'white' : (modoOscuro ? '#a0aec0' : '#4a5568'), fontWeight: 'bold', cursor: 'pointer', borderBottom: nivelSeleccionado === nivel ? '3px solid #ECC94B' : 'none', transition: 'all 0.2s' }}>
              {nivel}° AÑO
            </button>
          ))}
          <button onClick={() => setNivelSeleccionado('Todos')} style={{ padding: '8px 20px', borderRadius: '6px 6px 0 0', border: 'none', backgroundColor: nivelSeleccionado === 'Todos' ? '#718096' : (modoOscuro ? '#2d3748' : '#e2e8f0'), color: 'white', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px' }}>VER TODO</button>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
          <button onClick={() => generarPDF('single')} style={{backgroundColor: '#38a169', color:'white', border:'none', padding:'8px 15px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold'}}>📄 PDF Actual</button>
          <button onClick={() => generarPDF('full')} style={{backgroundColor: '#dd6b20', color:'white', border:'none', padding:'8px 15px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold'}}>📑 PDF Completo</button>
        </div>
      </div>

      {/* 3. GRILLA PRINCIPAL */}
      <div className="custom-scroll" style={{ backgroundColor: modoOscuro ? '#2d3748' : 'white', borderRadius: '0 8px 8px 8px', padding: '1px', border: `1px solid ${bordeColor}`, overflowX: 'auto', flex: 1, boxShadow: '0 4px 6px rgba(0,0,0,0.05)', position: 'relative', display: 'flex', flexDirection: 'column', marginBottom: '60px' }}>
        
        {nivelSeleccionado !== 'Todos' && <div style={{position: 'absolute', top: '50px', right: '20px', fontSize: '4rem', fontWeight: 'bold', opacity: 0.05, pointerEvents: 'none', color: textoColor}}>{nivelSeleccionado}° AÑO</div>}

        <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'separate', borderSpacing: 0, color: textoColor, tableLayout: 'fixed', fontSize: '0.8rem', flex: 1 }}>
          <thead>
            <tr>
              <th style={{ padding: '12px', borderBottom: `2px solid ${bordeColor}`, borderRight: `1px solid ${bordeColor}`, width: '90px', backgroundColor: headerBg, position: 'sticky', top: 0, zIndex: 10, color: modoOscuro ? '#a0aec0' : '#718096' }}>Horario</th>
              {DIAS.map(dia => <th key={dia} style={{ padding: '12px', borderBottom: `2px solid ${bordeColor}`, borderRight: dia !== 'Sábado' ? `1px solid ${bordeColor}` : 'none', backgroundColor: headerBg, position: 'sticky', top: 0, zIndex: 10 }}>{dia}</th>)}
            </tr>
          </thead>
          <tbody>
            {BLOQUES.map((bloque) => {
               const [inicio, fin] = bloque.split(' - ');
               return (
                <tr key={bloque}>
                  <td style={{ borderBottom: `1px solid ${bordeColor}`, borderRight: `1px solid ${bordeColor}`, backgroundColor: modoOscuro ? '#232d3b' : '#f8fafc', height: '70px', padding: '0 5px' }}>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                      <span style={{fontWeight: 'bold', fontSize: '0.85rem'}}>{inicio}</span>
                      <span style={{fontSize: '0.7rem', opacity: 0.6, marginTop: '-2px'}}>{fin}</span>
                    </div>
                  </td>
                  {DIAS.map((dia, i) => {
                    const asignados = getBloquesEnCelda(ofertaVisual, dia, bloque);
                    const isLast = i === DIAS.length - 1;
                    return (
                      <td key={`${dia}-${bloque}`} onClick={() => handleCeldaClick(dia, bloque)} style={{ borderBottom: `1px solid ${bordeColor}`, borderRight: isLast ? 'none' : `1px solid ${bordeColor}`, verticalAlign: 'top', cursor: 'pointer', padding: '4px', position: 'relative', transition: 'background-color 0.2s', backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = cellHover} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        {asignados.map(oferta => {
                          const isSelected = bloquesSeleccionados.includes(oferta.id);
                          return (
                            <div 
                              key={oferta.id} 
                              onClick={(e) => toggleSeleccionBloque(e, oferta.id)}
                              style={{ 
                                backgroundColor: oferta.es_atemporal ? '#F6E05E' : '#4299e1', 
                                color: oferta.es_atemporal ? '#744210' : 'white', 
                                padding: '4px 6px', borderRadius: '4px', fontSize: '0.75rem', marginBottom: '2px', 
                                cursor: 'pointer', 
                                boxShadow: isSelected ? '0 0 0 3px #e53e3e, 0 4px 6px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)', 
                                borderLeft: oferta.es_atemporal ? '3px solid #D69E2E' : '3px solid #2b6cb0', 
                                transition: 'transform 0.1s, box-shadow 0.1s',
                                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                                zIndex: isSelected ? 2 : 1, position: 'relative'
                              }} 
                              title={`${getNombreRamo(oferta.ramo_id)}`}
                            >
                              <div style={{fontWeight: 'bold', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'}}>{getNombreRamo(oferta.ramo_id)}</div>
                              {oferta.sala && <div style={{fontSize: '0.65rem', opacity: 0.9, marginTop: '2px'}}>📍 {oferta.sala}</div>}
                              {isSelected && <div style={{position: 'absolute', top: -5, right: -5, background: '#e53e3e', color: 'white', borderRadius: '50%', width: 15, height: 15, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>✓</div>}
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* BARRA DE ACCIÓN FLOTANTE */}
      {bloquesSeleccionados.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#1a202c', color: 'white', padding: '15px 30px', borderRadius: '50px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: '20px', animation: 'slideUp 0.3s ease-out'
        }}>
          <span style={{fontWeight: 'bold', color: '#63b3ed'}}>{bloquesSeleccionados.length} seleccionados</span>
          <div style={{height: '20px', width: '1px', backgroundColor: '#4a5568'}}></div>
          <button onClick={abrirEdicionMasiva} style={{background: '#38a169', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold'}}>✏️ Editar</button>
          <button onClick={borrarSeleccionados} style={{background: '#e53e3e', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold'}}>🗑️ Eliminar</button>
          <button onClick={() => setBloquesSeleccionados([])} style={{background: 'transparent', border: '1px solid #718096', color: '#a0aec0', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer'}}>Cancelar</button>
        </div>
      )}

      {/* MODAL DE EDICIÓN MASIVA */}
      {modalAbierto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, backdropFilter: 'blur(3px)' }}>
           <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', width: '320px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', color: '#1a202c' }}>
              <h4 style={{margin: '0 0 15px 0', color: '#2d3748', fontSize: '1.1rem', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Editando Selección</h4>
              
              <div style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.8rem', color: '#4a5568'}}>Asignar Sala a Todos:</label>
                <input type="text" value={salaEdicion} onChange={(e) => setSalaEdicion(e.target.value)} placeholder="Ej: Sala 403" autoFocus style={{width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none', fontSize: '1rem'}} />
              </div>

              <div style={{marginBottom: '20px', padding: '10px', backgroundColor: '#FEFCBF', borderRadius: '6px', border: '1px solid #F6E05E', cursor: 'pointer'}} onClick={() => setAtemporalEdicion(!atemporalEdicion)}>
                <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem', width: '100%'}}>
                  <input type="checkbox" checked={atemporalEdicion} onChange={(e) => setAtemporalEdicion(e.target.checked)} style={{width: '18px', height: '18px', marginRight: '10px', accentColor: '#D69E2E'}} />
                  <span style={{fontWeight: 'bold', color: '#744210'}}>Marcar como Atemporal (Amarillo)</span>
                </label>
              </div>

              <div style={{display: 'flex', gap: '10px'}}>
                <button onClick={guardarEdicionMasiva} style={{flex: 2, padding: '10px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer'}}>Aplicar Cambios</button>
                <button onClick={() => setModalAbierto(false)} style={{flex: 1, padding: '10px', backgroundColor: '#E2E8F0', color: '#4A5568', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}>Cancelar</button>
              </div>
           </div>
        </div>
      )}

      {/* --- GHOST CONTAINERS PARA PDF --- */}
      <div id="ghost-pdf-root" style={{ position: 'fixed', left: '-9999px', top: 0 }}>
         {[1, 2, 3, 4, 5].map(nivel => (
            <div key={nivel} id={`pdf-export-nivel-${nivel}`} style={{ width: '1200px', padding: '40px', backgroundColor: 'white', color: 'black', fontFamily: 'Arial' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '3px solid #000', paddingBottom: '15px' }}>
                  <div style={{width: '250px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start'}}>
                    <img src={LOGO_UCM_URL} alt="UCM" style={{maxWidth: '200px', maxHeight: '150px', objectFit: 'contain'}} />
                  </div>
                  <div style={{textAlign: 'center', flex: 1}}>
                     <h1 style={{margin: 0, fontSize: '28px', textTransform: 'uppercase', fontWeight: 'bold'}}>Horario {semestreGestion}</h1>
                     <h2 style={{margin: '8px 0 0 0', fontSize: '20px', color: '#444'}}>Pedagogía en Matemática y Computación</h2>
                     <h3 style={{margin: '8px 0 0 0', fontSize: '26px', color: '#3182ce', fontWeight: 'bold', textTransform: 'uppercase'}}>{nivel}° AÑO</h3>
                  </div>
                  <div style={{width: '250px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end'}}>
                    <img src={LOGO_CARRERA_URL} alt="Carrera" style={{maxWidth: '150px', maxHeight: '180px', objectFit: 'contain'}} />
                  </div>
               </div>
               <table style={{ width: '100%', borderCollapse: 'collapse', color: 'black', tableLayout: 'fixed', fontSize: '0.75rem', border: '2px solid #000' }}>
                  <thead>
                     <tr style={{backgroundColor: '#e2e8f0'}}>
                        <th style={{padding: '10px', border: '1px solid #000', width: '100px', fontSize: '0.9rem'}}>HORA</th>
                        {DIAS.map(d => <th key={d} style={{padding: '10px', border: '1px solid #000', fontSize: '0.9rem'}}>{d.toUpperCase()}</th>)}
                     </tr>
                  </thead>
                  <tbody>
                     {BLOQUES.map(b => (
                        <tr key={b}>
                           <td style={{padding: '8px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem'}}>{b}</td>
                           {DIAS.map(d => {
                              const ofertaNivel = getOfertaPorNivel(nivel);
                              const items = getBloquesEnCelda(ofertaNivel, d, b);
                              return (
                                 <td key={d} style={{padding: '5px', border: '1px solid #000', verticalAlign: 'top', height: '80px'}}>
                                    {items.map(o => (
                                       <div key={o.id} style={{backgroundColor: o.es_atemporal ? '#FEFCBF' : '#EBF8FF', padding: '4px', marginBottom: '3px', fontSize: '0.75rem', border: '1px solid #000', borderRadius: '4px', color: 'black'}}>
                                          <div style={{fontWeight: 'bold', fontSize: '0.8rem'}}>{getNombreRamo(o.ramo_id)}</div>
                                          {o.sala && <div style={{marginTop: '2px', fontStyle: 'italic'}}>📍 {o.sala}</div>}
                                       </div>
                                    ))}
                                 </td>
                              )
                           })}
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         ))}
      </div>
    </div>
  );
}