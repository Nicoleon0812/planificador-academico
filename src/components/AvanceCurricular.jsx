import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';

import { CalculadoraNotas } from './CalculadoraNotas';

export function AvanceCurricular({ emailEstudiante, catalogo, modoOscuro }) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  // Estado Selección de Plan
  const [planSeleccionado, setPlanSeleccionado] = useState(null); 

  // Modal simplificado
  const [ramoEditando, setRamoEditando] = useState(null);
  const [mostrarCalculadora, setMostrarCalculadora] = useState(false);
  const [notaInput, setNotaInput] = useState('');

  const tema = {
    fondo: modoOscuro ? '#1a202c' : '#fff',
    texto: modoOscuro ? '#e2e8f0' : '#2d3748',
    tarjeta: modoOscuro ? '#2d3748' : '#f7fafc',
    borde: modoOscuro ? '#4a5568' : '#e2e8f0',
    barraFondo: modoOscuro ? '#4a5568' : '#e2e8f0'
  };

  useEffect(() => {
    cargarHistorial();
  }, [emailEstudiante]);

  const cargarHistorial = async () => {
    setCargando(true);
    const { data } = await supabase
      .from('historial_academico')
      .select('*')
      .eq('email_estudiante', emailEstudiante);
    setHistorial(data || []);
    setCargando(false);
  };

  const catalogoFiltrado = useMemo(() => {
    if (!planSeleccionado) return [];
    return catalogo.filter(r => r.plan === planSeleccionado);
  }, [catalogo, planSeleccionado]);

  // --- CÁLCULOS AUTOMÁTICOS ---
  const estadisticas = useMemo(() => {
    // Si no hay plan seleccionado, devolvemos ceros
    if (!catalogoFiltrado.length) return { avance: 0, ppa: 0, creditos: 0, total: 0 };

    let totalCreditosPlan = 0;
    let creditosAprobados = 0;
    let sumaNotasPonderadas = 0;
    let sumaCreditosConNota = 0;

    // 1. Calculamos el TOTAL de créditos que tiene ESTE plan
    catalogoFiltrado.forEach(r => totalCreditosPlan += (r.creditos || 0));

    // 2. Revisamos qué ha aprobado el alumno
    historial.forEach(h => {
      // Buscamos si el ramo aprobado pertenece a este plan
      const ramo = catalogoFiltrado.find(r => r.id === h.ramo_id);
      
      if (ramo && h.estado === 'aprobado') {
        creditosAprobados += ramo.creditos;
        
        // Para el PPA (Promedio)
        if (h.nota && h.nota > 0) {
          sumaNotasPonderadas += (parseFloat(h.nota) * ramo.creditos);
          sumaCreditosConNota += ramo.creditos;
        }
      }
    });

    const porcentaje = totalCreditosPlan > 0 ? Math.round((creditosAprobados / totalCreditosPlan) * 100) : 0;
    const ppa = sumaCreditosConNota > 0 ? (sumaNotasPonderadas / sumaCreditosConNota).toFixed(1) : '0.0';

    return { avance: porcentaje, ppa, creditos: creditosAprobados, total: totalCreditosPlan };
  }, [historial, catalogoFiltrado]);

  // --- ACCIONES SIMPLIFICADAS ---
  const abrirModalNota = (ramo) => {
    const registro = historial.find(h => h.ramo_id === ramo.id);
    setNotaInput(registro?.nota || '');
    setRamoEditando(ramo);
  };

  const guardarInteligente = async () => {
    if (!ramoEditando) return;
    
    const notaNum = parseFloat(notaInput);
    let nuevoEstado = 'cursando';

    if (notaInput !== '' && !isNaN(notaNum)) {
        if (notaNum >= 4.0) nuevoEstado = 'aprobado';
        else nuevoEstado = 'reprobado';
    } else {
        alert("Por favor ingresa una nota válida");
        return;
    }

    const datos = {
      email_estudiante: emailEstudiante,
      ramo_id: ramoEditando.id,
      estado: nuevoEstado,
      nota: notaNum
    };

    const { error } = await supabase
      .from('historial_academico')
      .upsert(datos, { onConflict: 'email_estudiante, ramo_id' });

    if (!error) {
      cargarHistorial();
      setRamoEditando(null);
    } else {
      console.error(error);
      alert("Error al guardar: " + error.message);
    }
  };

  const guardarComoCursando = async () => {
     if (!ramoEditando) return;
     const { error } = await supabase.from('historial_academico').upsert({
        email_estudiante: emailEstudiante,
        ramo_id: ramoEditando.id,
        estado: 'cursando',
        nota: null
     }, { onConflict: 'email_estudiante, ramo_id' });
     
     if(!error) { cargarHistorial(); setRamoEditando(null); }
  }

  const eliminarRegistro = async () => {
    if (!ramoEditando) return;
    await supabase.from('historial_academico').delete()
      .eq('email_estudiante', emailEstudiante)
      .eq('ramo_id', ramoEditando.id);
    cargarHistorial();
    setRamoEditando(null);
  };

  if (cargando) return <div style={{padding:'20px'}}>Cargando historial...</div>;

  // PANTALLA SELECCIÓN PLAN
  if (!planSeleccionado) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: tema.texto, textAlign: 'center' }}>
        <h2 style={{ marginBottom: '10px', color: '#3182ce' }}>¡Bienvenido a tu Progreso!</h2>
        <p style={{ marginBottom: '30px', opacity: 0.8 }}>Para comenzar, selecciona tu Plan de Estudios:</p>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button onClick={() => setPlanSeleccionado('2026')} style={{ padding: '15px 30px', borderRadius: '10px', border: 'none', backgroundColor: '#3182ce', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Plan Nuevo (2026)</button>
          <button onClick={() => setPlanSeleccionado('2022')} style={{ padding: '15px 30px', borderRadius: '10px', border: `2px solid #3182ce`, backgroundColor: 'transparent', color: tema.texto, fontWeight: 'bold', cursor: 'pointer' }}>Plan Antiguo (2022)</button>
        </div>
      </div>
    );
  }

  // PANTALLA PRINCIPAL
  const ramosPorSemestre = [1,2,3,4,5,6,7,8,9,10].map(sem => ({
    semestre: sem,
    ramos: catalogoFiltrado.filter(r => r.semestre === sem)
  }));

  return (
    <div style={{ padding: '20px', color: tema.texto }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
         <h2 style={{margin:0}}>📊 Mi Avance Académico</h2>
         <button onClick={() => setPlanSeleccionado(null)} style={{ fontSize: '0.8rem', padding: '5px 10px', borderRadius: '5px', border: `1px solid ${tema.borde}`, background: 'transparent', color: tema.texto, cursor: 'pointer' }}>Cambiar Plan ({planSeleccionado}) 🔄</button>
      </div>

      {/* DASHBOARD */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '30px', backgroundColor: tema.tarjeta, padding: '20px', borderRadius: '12px', border: `1px solid ${tema.borde}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
           <div style={{ position: 'relative', width: '70px', height: '70px' }}>
              <svg width="70" height="70" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={tema.barraFondo} strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#48bb78" strokeWidth="3" strokeDasharray={`${estadisticas.avance}, 100`} />
              </svg>
              <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 'bold'}}>{estadisticas.avance}%</div>
           </div>
           
           {/* 👇 AQUÍ RECUPERÉ LOS CRÉDITOS 👇 */}
           <div>
             <h3 style={{margin:0}}>Avance</h3>
             <span style={{fontSize:'0.9rem', opacity:0.8}}>
                {estadisticas.creditos} / {estadisticas.total} Créditos
             </span>
           </div>

        </div>
        <div style={{ flex: 1, borderLeft: `2px solid ${tema.borde}`, paddingLeft:'20px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
           <h4 style={{margin:0, opacity:0.7, fontSize:'0.8rem'}}>PROMEDIO (PPA)</h4>
           <div style={{fontSize:'2rem', fontWeight:'bold', color: '#3182ce'}}>{estadisticas.ppa}</div>
        </div>
      </div>

      {/* MALLA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
        {ramosPorSemestre.map((sem) => (
          sem.ramos.length > 0 && (
            <div key={sem.semestre} style={{ marginBottom: '10px' }}>
              <h4 style={{margin:'0 0 8px 0', opacity:0.6, fontSize:'0.9rem'}}>Semestre {sem.semestre}</h4>
              <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                {sem.ramos.map(ramo => {
                  const registro = historial.find(h => h.ramo_id === ramo.id);
                  let estadoColor = 'transparent'; 
                  let bordeColor = tema.borde;
                  let texto = '';

                  if(registro?.estado === 'aprobado') { 
                    estadoColor = modoOscuro ? 'rgba(72, 187, 120, 0.2)' : '#f0fff4'; bordeColor = '#48bb78'; texto = registro.nota;
                  } else if(registro?.estado === 'cursando') {
                    estadoColor = modoOscuro ? 'rgba(66, 153, 225, 0.2)' : '#ebf8ff'; bordeColor = '#4299e1'; texto = 'Cursando';
                  } else if(registro?.estado === 'reprobado') {
                    estadoColor = modoOscuro ? 'rgba(245, 101, 101, 0.2)' : '#fff5f5'; bordeColor = '#f56565'; texto = registro.nota;
                  }

                  return (
                    <div key={ramo.id} onClick={() => abrirModalNota(ramo)}
                      style={{ padding:'8px', borderRadius:'6px', border: `1px solid ${bordeColor}`, backgroundColor: estadoColor, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{overflow:'hidden'}}>
                        <div style={{fontWeight:'bold', fontSize:'0.85rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{ramo.nombre}</div>
                        <div style={{fontSize:'0.7rem', opacity:0.7}}>{ramo.id}</div>
                      </div>
                      {texto && <div style={{fontSize:'0.8rem', fontWeight:'bold', color: bordeColor}}>{texto}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ))}
      </div>

      {/* MODAL SIMPLIFICADO */}
      {ramoEditando && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.6)', backdropFilter:'blur(2px)', zIndex: 1000, display:'flex', justifyContent:'center', alignItems:'center' }}>
          <div style={{ backgroundColor: modoOscuro ? '#2d3748' : 'white', padding: '25px', borderRadius: '15px', width: '320px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', textAlign:'center' }}>
            
            <h3 style={{margin:'0 0 5px 0', color: modoOscuro ? 'white' : '#2d3748'}}>{ramoEditando.nombre}</h3>
            <p style={{fontSize:'0.8rem', opacity:0.7, margin:'0 0 20px 0'}}>Ingresa tu promedio final</p>

            <input 
                type="number" step="0.1" min="1.0" max="7.0"
                value={notaInput} 
                onChange={(e) => setNotaInput(e.target.value)}
                placeholder="Ej: 6.5"
                autoFocus
                style={{
                  width: '60%', padding: '15px', borderRadius: '12px', marginBottom:'20px',
                  border: '3px solid #3182ce', fontSize: '2rem', fontWeight: 'bold', textAlign: 'center',
                  backgroundColor: modoOscuro ? '#1a202c' : '#f7fafc', color: tema.texto, outline:'none'
                }}
            />

            <button onClick={guardarInteligente} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'none', background:'#3182ce', color:'white', fontWeight:'bold', fontSize:'1rem', cursor:'pointer', marginBottom:'10px'}}>
              Guardar Nota
            </button>
            <button 
                onClick={() => setMostrarCalculadora(true)}
                style={{
                    width:'100%', padding:'10px', borderRadius:'8px', border:'2px dashed #48bb78', 
                    background:'transparent', color: modoOscuro ? '#48bb78' : '#2f855a', fontWeight:'bold', 
                    cursor:'pointer', marginBottom:'15px', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px'
                }}
            >
               🧮 Calculadora de Notas
            </button>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.85rem', marginTop:'10px'}}>
                <span onClick={guardarComoCursando} style={{color:'#4299e1', cursor:'pointer', textDecoration:'underline'}}>Solo estoy cursando</span>
                <span onClick={eliminarRegistro} style={{color:'#e53e3e', cursor:'pointer'}}>Borrar registro</span>
            </div>
            
            <button onClick={() => setRamoEditando(null)} style={{marginTop:'20px', background:'transparent', border:'none', color: tema.texto, opacity:0.5, cursor:'pointer'}}>Cancelar</button>
          </div>
        </div>
      )}
      {mostrarCalculadora && ramoEditando && (
          <CalculadoraNotas 
             emailEstudiante={emailEstudiante}
             ramo={ramoEditando}
             modoOscuro={modoOscuro}
             onClose={() => setMostrarCalculadora(false)}
          />
      )}
    </div>
  );
}