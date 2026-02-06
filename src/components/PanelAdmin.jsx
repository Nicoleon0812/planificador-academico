import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import html2canvas from 'html2canvas';
import { GestorHorarios } from './GestorHorarios';
import { DashboardHome } from './DashboardHome';

export function PanelAdmin({ catalogo, onSalir, modoOscuro }) {
  // --- ESTADOS ---
  const [pestana, setPestana] = useState('estudiantes');
  const [busqueda, setBusqueda] = useState('');
  const [estudiantesEncontrados, setEstudiantesEncontrados] = useState([]);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [mallaSeleccionada, setMallaSeleccionada] = useState('2026');

  // Datos del alumno
  const [historial, setHistorial] = useState([]);
  const [observacion, setObservacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [seleccionados, setSeleccionados] = useState([]); 
  
  // ✅ NUEVO: Estado del Alumno (Activo/Egresado)
  const [estadoAlumno, setEstadoAlumno] = useState('activo');

  // Estados para el Modal de Edición de Causal
  const [modalEdicionOpen, setModalEdicionOpen] = useState(false);
  const [ramoAEditar, setRamoAEditar] = useState(null);
  const [contadorReprobaciones, setContadorReprobaciones] = useState(0);

  // --- UTILIDADES ---
  const formatearNombre = (email) => {
    if (!email) return '';
    return email.split('@')[0].replace(/\./g, ' ').toUpperCase();
  };

  const numerosRomanos = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

  // --- BUSQUEDA ---
  useEffect(() => {
    async function buscar() {
      if (busqueda.length < 3) {
        setEstudiantesEncontrados([]);
        return;
      }
      const { data } = await supabase
        .from('lista_blanca')
        .select('email')
        .ilike('email', `%${busqueda}%`)
        .limit(10);

      if (data) {
        setEstudiantesEncontrados(data.map(item => item.email));
      }
    }
    const timeout = setTimeout(buscar, 500);
    return () => clearTimeout(timeout);
  }, [busqueda]);

  // --- REGISTRAR ---
  const registrarNuevoAlumno = async () => {
    if (!busqueda.includes('@') || busqueda.length < 5) return alert("Ingrese un correo válido");
    const nuevoEmail = busqueda.toLowerCase().trim();
    
    // Por defecto se crea como 'activo'
    const { error } = await supabase.from('lista_blanca').insert({ email: nuevoEmail, estado: 'activo' }).select();

    if (error) {
        if (error.code === '23505') { cargarAlumno(nuevoEmail); } 
        else { alert("Error: " + error.message); }
    } else {
        await supabase.from('perfiles_estudiantes').insert({ email: nuevoEmail, observaciones: 'Registrado por Admin.' });
        cargarAlumno(nuevoEmail);
    }
  };

  // --- CARGA ---
  const cargarAlumno = async (email) => {
    setAlumnoSeleccionado(email);
    setEstudiantesEncontrados([]);
    setBusqueda(''); 
    setSeleccionados([]); 
    
    // 1. Historial
    const { data: dataHistorial } = await supabase.from('historial_academico').select('*').eq('email_estudiante', email);
    setHistorial(dataHistorial || []);

    // 2. Observaciones
    const { data: dataPerfil } = await supabase.from('perfiles_estudiantes').select('observaciones').eq('email', email).single();
    setObservacion(dataPerfil?.observaciones || '');

    // 3. ✅ Estado (Activo/Egresado)
    const { data: dataEstado } = await supabase.from('lista_blanca').select('estado').eq('email', email).single();
    setEstadoAlumno(dataEstado?.estado || 'activo');
  };

  const reiniciarBusqueda = () => {
    setAlumnoSeleccionado(null);
    setBusqueda('');
    setHistorial([]);
    setObservacion('');
    setSeleccionados([]);
    setEstadoAlumno('activo');
  };

  // ✅ NUEVO: CAMBIAR ESTADO MANUALMENTE
  const cambiarEstadoManual = async (nuevoEstado) => {
      const { error } = await supabase
          .from('lista_blanca')
          .update({ estado: nuevoEstado })
          .eq('email', alumnoSeleccionado);

      if (!error) {
          setEstadoAlumno(nuevoEstado);
          // Feedback visual sutil o alerta
          // alert(`Estado actualizado a: ${nuevoEstado.toUpperCase()}`);
      } else {
          alert("Error al actualizar estado: " + error.message);
      }
  };

  // --- EDICIÓN MASIVA ---
  const toggleSeleccion = (ramoId) => {
    if (seleccionados.includes(ramoId)) setSeleccionados(seleccionados.filter(id => id !== ramoId)); 
    else setSeleccionados([...seleccionados, ramoId]); 
  };

  // ✅ LOGICA DE ESTADO MASIVO CORREGIDA (BLINDADA)
  const aplicarEstadoMasivo = async (nuevoEstado) => {
    if (!alumnoSeleccionado || seleccionados.length === 0) return alert("Seleccione ramos primero.");
    setGuardando(true);
    try {
      // 1. GUARDAR CAMBIOS EN EL HISTORIAL
      const actualizaciones = seleccionados.map(ramoId => {
         const previo = historial.find(h => h.ramo_id === ramoId);
         return {
             email_estudiante: alumnoSeleccionado,
             ramo_id: ramoId,
             estado: nuevoEstado,
             nota: previo?.nota || null,
             veces_reprobado: previo?.veces_reprobado || 0
         };
      });

      const { error } = await supabase.from('historial_academico').upsert(actualizaciones, { onConflict: 'email_estudiante, ramo_id' });
      if(error) throw error;

      // =================================================================================
      // 🚀 2. VERIFICACIÓN AUTOMÁTICA
      // =================================================================================
      
      // A. Traer datos frescos
      const { data: historialActualizado } = await supabase.from('historial_academico').select('*').eq('email_estudiante', alumnoSeleccionado);
      
      // B. Cálculos
      const cantidadAprobados = historialActualizado.filter(h => h.estado === 'aprobado').length;
      
      // ⚠️ SEGURIDAD: Usamos el catálogo filtrado por la malla seleccionada
      const totalRamosMalla = catalogo.filter(r => r.plan === mallaSeleccionada).length;

      // 🛑 FRENO DE MANO: Si el catálogo da 0 (error de selección), no hacemos nada automático
      if (totalRamosMalla > 0) {
          
          if (cantidadAprobados >= totalRamosMalla) {
              // CASO: COMPLETÓ TODO
              if (estadoAlumno !== 'egresado') {
                  await cambiarEstadoManual('egresado');
                  alert(`🎓 ¡AUTOMÁTICO!\nEstudiante completó la malla (${cantidadAprobados}/${totalRamosMalla}).\nEstado cambiado a: EGRESADO.`);
              }
          } else {
              // CASO: LE FALTA ALGO (Debe ser Activo)
              if (estadoAlumno === 'egresado') {
                  await cambiarEstadoManual('activo');
                  alert(`ℹ️ AUTOMÁTICO\nAl quitar ramos aprobados, el estudiante vuelve a ser ACTIVO.`);
              }
          }
      }
      // =================================================================================

      await cargarAlumno(alumnoSeleccionado);
      setSeleccionados([]);

    } catch (error) { 
        console.error(error); 
        alert("Error: " + error.message); 
    } finally { 
        setGuardando(false); 
    }
  };

  const guardarObservacion = async () => {
    if(!alumnoSeleccionado) return;
    setGuardando(true);
    await supabase.from('perfiles_estudiantes').upsert({ email: alumnoSeleccionado, observaciones: observacion });
    setGuardando(false);
    alert("✅ Observación guardada");
  };

  // FUNCIONES DEL MODAL DE DETALLE
  const abrirModalDetalle = (ramo) => {
      const registro = historial.find(h => h.ramo_id === ramo.id);
      setRamoAEditar(ramo);
      setContadorReprobaciones(registro?.veces_reprobado || 0);
      setModalEdicionOpen(true);
  };

  const guardarDetalleRamo = async () => {
      if (!ramoAEditar) return;
      
      const registroPrevio = historial.find(h => h.ramo_id === ramoAEditar.id);
      
      const datos = {
          email_estudiante: alumnoSeleccionado,
          ramo_id: ramoAEditar.id,
          estado: registroPrevio?.estado || 'pendiente',
          nota: registroPrevio?.nota || null,
          veces_reprobado: contadorReprobaciones
      };

      const { error } = await supabase.from('historial_academico').upsert(datos, { onConflict: 'email_estudiante, ramo_id' });
      
      if (!error) {
          await cargarAlumno(alumnoSeleccionado);
          setModalEdicionOpen(false);
      } else {
          alert("Error al guardar detalle");
      }
  };

  // --- COLORES ---
  const getEstadoItem = (ramoId) => historial.find(h => h.ramo_id === ramoId);
  
  const getColorUI = (ramoId) => {
    const item = getEstadoItem(ramoId);
    if (!item) return modoOscuro ? '#2d3748' : '#fff'; 
    if (item.estado === 'aprobado') return '#48bb78'; 
    if (item.estado === 'cursando') return '#4299e1'; 
    if (item.estado === 'reprobado') return '#f56565'; 
    return 'gray';
  };

  const ramosVisibles = catalogo.filter(r => r.plan === mallaSeleccionada);

  // --- EXPORTACIÓN ---
  const exportarFichaOficial = async () => {
    const elemento = document.getElementById('printable-ficha-oficial');
    if (!elemento) return;
    try {
      const canvas = await html2canvas(elemento, { 
        scale: 2, backgroundColor: '#ffffff', useCORS: true,
        windowWidth: 1600, windowHeight: elemento.scrollHeight 
      });
      const link = document.createElement('a');
      link.download = `Malla_${mallaSeleccionada}_${formatearNombre(alumnoSeleccionado)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) { alert("Error al exportar"); }
  };

  return (
    <div style={{ padding: '20px', color: modoOscuro ? '#e2e8f0' : '#2d3748', minHeight: '100vh', backgroundColor: modoOscuro ? '#1a202c' : '#f7fafc' }}>
      
      {/* ======================= CONTENEDOR FANTASMA (REPORTE OFICIAL) ======================= */}
      {alumnoSeleccionado && (
        <div id="printable-ficha-oficial" style={{ position: 'fixed', left: '-9999px', top: 0, width: '1500px', backgroundColor: 'white', color: 'black', fontFamily: 'Arial, sans-serif', padding: '30px', border: '1px solid black' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black' }}>
              <h1 style={{ margin: 0, fontSize: '24px' }}>MALLA CURRICULAR PLAN {mallaSeleccionada}</h1>
              <h2 style={{ fontSize: '18px', fontWeight: 'normal' }}>Estudiante: <strong>{formatearNombre(alumnoSeleccionado)}</strong></h2>
              {/* Mostramos el estado en el reporte también */}
              <p>Estado: {estadoAlumno.toUpperCase()}</p>
            </div>
            
            {/* GRID MATRIZ PARA PDF */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '10px', alignItems: 'start' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(semestre => (
                <div key={semestre} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '5px' }}>{numerosRomanos[semestre-1]}</div>
                  {ramosVisibles.filter(r => r.semestre === semestre).map(ramo => {
                    const item = getEstadoItem(ramo.id);
                    let bg = 'white'; let border = 'black';
                    if (item?.estado === 'aprobado') { bg = '#d1e7dd'; border = '#0f5132'; }
                    else if (item?.estado === 'cursando') { bg = '#cff4fc'; border = '#055160'; }
                    else if (item?.estado === 'reprobado') { bg = '#f8d7da'; border = '#842029'; }
                    
                    return (
                      <div key={ramo.id} style={{ backgroundColor: bg, border: `1px solid ${border}`, padding: '8px', textAlign: 'center', fontSize: '11px', minHeight: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{fontWeight: 'bold'}}>{ramo.nombre}</div>
                        <div>({ramo.creditos} SCT)</div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
                <strong>Observaciones:</strong> <br/> {observacion || 'Sin observaciones registradas.'}
            </div>
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2>👩‍💻 Panel de Gestión Académica</h2>
        <button onClick={onSalir} style={{ padding: '8px 16px', backgroundColor: '#718096', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Salir</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => setPestana('estudiantes')} style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', cursor: 'pointer', backgroundColor: pestana === 'estudiantes' ? '#c53030' : '#4a5568', color: 'white', fontWeight: 'bold' }}>🎓 Validación Estudiantes</button>
        <button onClick={() => setPestana('horarios')} style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', cursor: 'pointer', backgroundColor: pestana === 'horarios' ? '#c53030' : '#4a5568', color: 'white', fontWeight: 'bold' }}>🗓️ Horarios Generales</button>
      </div>

      {pestana === 'estudiantes' && (
        <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
          {!alumnoSeleccionado && (
             <div style={{ position: 'relative' }}>
               <div style={{display: 'flex', gap: '10px'}}>
                 <input type="text" placeholder="Escriba correo del estudiante..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ flex: 1, padding: '15px', fontSize: '18px', borderRadius: '8px', border: '1px solid #cbd5e0' }} />
                 {busqueda.includes('@') && estudiantesEncontrados.length === 0 && (
                   <button onClick={registrarNuevoAlumno} style={{ padding: '0 20px', backgroundColor: '#38a169', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>➕ Alta Rápida</button>
                 )}
               </div>
               {estudiantesEncontrados.length > 0 && (
                 <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #cbd5e0', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                   {estudiantesEncontrados.map(email => (
                     <div key={email} onClick={() => cargarAlumno(email)} style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid #eee', color: '#333' }}>
                       <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{formatearNombre(email).toLowerCase()}</span> <span style={{fontSize: '0.8em', color: '#666'}}>({email})</span>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          )}

          {alumnoSeleccionado ? (
            <div style={{ padding: '20px', backgroundColor: modoOscuro ? '#2d3748' : 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              
              {/* --- ENCABEZADO CON SELECTOR MANUAL Y BOTONES RECUPERADOS --- */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #ddd', paddingBottom: '15px' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#3182ce' }}>{formatearNombre(alumnoSeleccionado)}</h2>
                  <span style={{ fontSize: '0.9rem', color: modoOscuro ? '#a0aec0' : '#718096' }}>{alumnoSeleccionado}</span>
                  
                  {/* ✅ SELECTOR MANUAL DE ESTADO */}
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{fontWeight:'bold', fontSize:'0.9rem'}}>Estado:</label>
                      <select 
                          value={estadoAlumno} 
                          onChange={(e) => cambiarEstadoManual(e.target.value)}
                          style={{
                              padding: '5px', 
                              borderRadius: '5px', 
                              border: `1px solid ${estadoAlumno === 'egresado' ? '#38a169' : '#3182ce'}`,
                              fontWeight: 'bold',
                              color: estadoAlumno === 'egresado' ? '#2f855a' : '#2b6cb0',
                              backgroundColor: modoOscuro ? '#1a202c' : 'white'
                          }}
                      >
                          <option value="activo">🟢 Activo</option>
                          <option value="egresado">🎓 Egresado</option>
                          <option value="suspendido">🔴 Suspendido</option>
                      </select>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <select value={mallaSeleccionada} onChange={(e) => setMallaSeleccionada(e.target.value)} style={{ padding: '10px', borderRadius: '5px', fontWeight: 'bold', border: '2px solid #3182ce' }}>
                    <option value="2026">Plan 2026 (Nuevo)</option>
                    <option value="2022">Plan 2022 (Antiguo)</option>
                  </select>
                  
                  {/* ✅ BOTÓN RECUPERADO */}
                  <button onClick={exportarFichaOficial} title="Descargar Matriz" style={{ padding: '10px 15px', backgroundColor: '#38a169', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>📄 Descargar Reporte</button>
                  
                  <button onClick={reiniciarBusqueda} title="Buscar otro alumno" style={{ padding: '10px 15px', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🔄 Otro</button>
                </div>
              </div>

              {/* BARRA DE HERRAMIENTAS */}
              <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: modoOscuro ? '#1a202c' : '#f7fafc', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                   <span style={{ fontWeight: 'bold' }}>Acciones:</span>
                   <small style={{opacity:0.7}}>Doble click para editar detalle</small>
                 </div>
                 <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => aplicarEstadoMasivo('aprobado')} disabled={seleccionados.length === 0} style={{ padding: '5px 10px', backgroundColor: '#48bb78', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✅ Aprobado</button>
                    <button onClick={() => aplicarEstadoMasivo('reprobado')} disabled={seleccionados.length === 0} style={{ padding: '5px 10px', backgroundColor: '#f56565', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🔴 Reprobado</button>
                    <button onClick={() => aplicarEstadoMasivo('cursando')} disabled={seleccionados.length === 0} style={{ padding: '5px 10px', backgroundColor: '#4299e1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🔵 Cursando</button>
                    <button onClick={() => aplicarEstadoMasivo('pendiente')} disabled={seleccionados.length === 0} style={{ padding: '5px 10px', backgroundColor: '#a0aec0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>⚪ Pendiente</button>
                 </div>
              </div>

              {/* GRID */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '10px', overflowX: 'auto', paddingBottom: '20px' }}>
                {[1,2,3,4,5,6,7,8,9,10].map(semestre => (
                  <div key={semestre} style={{ minWidth: '120px' }}>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #ccc' }}>{numerosRomanos[semestre-1]}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {ramosVisibles.filter(r => r.semestre === semestre).map(ramo => {
                        const esSeleccionado = seleccionados.includes(ramo.id);
                        
                        const itemHistorial = getEstadoItem(ramo.id);
                        const reprobadoCount = itemHistorial?.veces_reprobado || 0;
                        const enCausal = reprobadoCount >= 3;

                        return (
                          <div key={ramo.id} 
                            onClick={() => toggleSeleccion(ramo.id)}
                            onDoubleClick={() => abrirModalDetalle(ramo)}
                            title={enCausal ? "¡CAUSAL DE ELIMINACIÓN!" : "Doble click para editar detalles"}
                            style={{ 
                              padding: '8px', borderRadius: '6px', 
                              border: esSeleccionado ? '3px solid #ECC94B' : enCausal ? '3px solid red' : '1px solid #ccc',
                              backgroundColor: getColorUI(ramo.id),
                              color: getColorUI(ramo.id) === (modoOscuro ? '#2d3748' : '#fff') ? (modoOscuro ? 'white' : 'black') : 'white',
                              cursor: 'pointer', fontSize: '0.75rem', textAlign: 'center', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                              transform: esSeleccionado ? 'scale(1.05)' : 'scale(1)', transition: 'all 0.1s',
                              position: 'relative',
                              animation: enCausal ? 'pulse 2s infinite' : 'none'
                            }}>
                            
                            {enCausal && <div style={{position:'absolute', top:-5, right:-5, fontSize:'1.2rem'}}>⚠️</div>}
                            
                            <div style={{fontWeight: 'bold', marginBottom: '4px'}}>{ramo.nombre}</div>
                            <div style={{opacity: 0.8}}>{ramo.id}</div>
                            
                            {reprobadoCount > 0 && <div style={{marginTop:'5px', fontSize:'0.7rem', background:'rgba(0,0,0,0.2)', borderRadius:'4px'}}>Reprobado: {reprobadoCount}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* OBS EDITABLES */}
              <div style={{ marginTop: '20px', borderTop: '2px solid #ccc', paddingTop: '15px' }}>
                <h3 style={{ marginBottom: '10px' }}>📝 Observaciones</h3>
                <textarea rows="4" value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Notas administrativas..." style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #cbd5e0', backgroundColor: modoOscuro ? '#1a202c' : 'white', color: modoOscuro ? 'white' : 'black' }} />
                <button onClick={guardarObservacion} disabled={guardando} style={{ padding: '8px 20px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar Nota'}</button>
              </div>
            </div>
          ) : alumnoSeleccionado ? (
            <div style={{ textAlign: 'center', marginTop: '50px', color: '#a0aec0' }}><h3>Gestión de Estudiantes</h3><p>Busque un estudiante para comenzar.</p></div>
          ) : (
            <DashboardHome catalogo={catalogo} />
          )}
        </div>
      )}

      {pestana === 'horarios' && (
        <GestorHorarios catalogo={catalogo} modoOscuro={modoOscuro} />
      )}

      {/* MODAL DE EDICIÓN DE DETALLE (CAUSAL) */}
      {modalEdicionOpen && ramoAEditar && (
         <div style={{
             position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
             backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
             display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
         }}>
             <div style={{
                 backgroundColor: modoOscuro ? '#2d3748' : 'white',
                 padding: '25px', borderRadius: '10px', width: '400px',
                 boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                 color: modoOscuro ? 'white' : '#2d3748'
             }}>
                 <h3 style={{margin:'0 0 15px 0', borderBottom:'1px solid #ccc', paddingBottom:'10px'}}>
                     {ramoAEditar.nombre}
                 </h3>

                 <div style={{background: contadorReprobaciones >= 3 ? '#fed7d7' : (modoOscuro ? '#1a202c' : '#f7fafc'), padding: '15px', borderRadius: '8px', border: `1px solid ${contadorReprobaciones >= 3 ? 'red' : '#ccc'}`}}>
                     <label style={{display:'block', fontWeight:'bold', marginBottom:'10px', color: contadorReprobaciones >= 3 ? '#c53030' : 'inherit'}}>
                         ¿Número de veces reprobado?
                     </label>
                     
                     <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'20px'}}>
                         <button onClick={() => setContadorReprobaciones(Math.max(0, contadorReprobaciones - 1))} style={{width:'40px', height:'40px', fontSize:'1.5rem', cursor:'pointer'}}>-</button>
                         <span style={{fontSize:'2rem', fontWeight:'bold', color: contadorReprobaciones >= 3 ? '#c53030' : 'inherit'}}>{contadorReprobaciones}</span>
                         <button onClick={() => setContadorReprobaciones(contadorReprobaciones + 1)} style={{width:'40px', height:'40px', fontSize:'1.5rem', cursor:'pointer'}}>+</button>
                     </div>

                     {contadorReprobaciones >= 3 && (
                         <div style={{marginTop:'15px', fontWeight:'bold', color:'#c53030', textAlign:'center'}}>
                             ⚠️ ESTUDIANTE EN CAUSAL DE ELIMINACIÓN
                         </div>
                     )}
                 </div>

                 <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                     <button onClick={guardarDetalleRamo} style={{flex:1, padding:'10px', backgroundColor:'#3182ce', color:'white', border:'none', borderRadius:'5px', cursor:'pointer', fontWeight:'bold'}}>Guardar</button>
                     <button onClick={() => setModalEdicionOpen(false)} style={{flex:1, padding:'10px', backgroundColor:'transparent', border:'1px solid #ccc', borderRadius:'5px', cursor:'pointer', color: modoOscuro ? 'white' : 'black'}}>Cancelar</button>
                 </div>
             </div>
         </div>
      )}

    </div>
  );
}