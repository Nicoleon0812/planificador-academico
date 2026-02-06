import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export function DashboardHome({ catalogo }) {
  const [stats, setStats] = useState({
    totalAlumnos: 0,
    enRiesgo: [], // Lista de correos
    ramoMasDificil: '---',
    promedioGeneral: 0
  });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    calcularEstadisticas();
  }, []);

  const calcularEstadisticas = async () => {
    // 1. Obtener Total de Alumnos (Lista Blanca)
    const { count } = await supabase.from('lista_blanca').select('*', { count: 'exact', head: true}).eq('estado', 'activo');
    const totalAlumnos = count || 0;

    // 2. Obtener TODO el historial académico (Para buscar reprobados y riesgos)
    const { data: historial } = await supabase.from('historial_academico').select('*');

    if (!historial || historial.length === 0) {
      setStats({ totalAlumnos, enRiesgo: [], ramoMasDificil: 'N/A', promedioGeneral: 0 });
      setCargando(false);
      return;
    }

    // --- CÁLCULO 1: ALUMNOS EN RIESGO (Causal Eliminación) ---
    // Buscamos registros donde veces_reprobado >= 3
    const riesgos = historial
        .filter(h => h.veces_reprobado >= 3)
        .map(h => h.email_estudiante);
    
    // Quitamos duplicados (si un alumno tiene 2 ramos en causal)
    const riesgosUnicos = [...new Set(riesgos)];

    // --- CÁLCULO 2: RAMO MÁS DIFÍCIL ---
    // Contamos cuál ramo_id se repite más con estado 'reprobado'
    const reprobacionesPorRamo = {};
    historial.filter(h => h.estado === 'reprobado').forEach(h => {
        reprobacionesPorRamo[h.ramo_id] = (reprobacionesPorRamo[h.ramo_id] || 0) + 1;
    });

    let maxReprobaciones = 0;
    let idRamoDificil = '';
    
    Object.entries(reprobacionesPorRamo).forEach(([id, count]) => {
        if (count > maxReprobaciones) {
            maxReprobaciones = count;
            idRamoDificil = id;
        }
    });

    // Buscamos el nombre real del ramo en el catálogo
    const nombreRamo = catalogo.find(r => r.id === idRamoDificil)?.nombre || idRamoDificil;

    // --- CÁLCULO 3: PROMEDIO GENERAL ---
    // Solo de las notas que existen
    const notas = historial.filter(h => h.nota > 0).map(h => h.nota);
    const sumaNotas = notas.reduce((a, b) => a + b, 0);
    const promedio = notas.length > 0 ? (sumaNotas / notas.length).toFixed(1) : 0;

    setStats({
      totalAlumnos,
      enRiesgo: riesgosUnicos,
      ramoMasDificil: nombreRamo,
      promedioGeneral: promedio
    });
    setCargando(false);
  };

  if (cargando) return <div style={{padding:'20px'}}>Calculando estadísticas...</div>;

  return (
    <div style={{padding: '20px'}}>
      <h2 style={{marginTop:0}}>📈 Resumen de la Carrera</h2>
      
      {/* TARJETAS DE KPI */}
      <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px'}}>
        
        {/* Total Estudiantes */}
        <div style={cardStyle}>
            <div style={{fontSize:'3rem', fontWeight:'bold', color:'#3182ce'}}>{stats.totalAlumnos}</div>
            <div style={{color:'#718096'}}>Estudiantes Activos</div>
        </div>

        {/* En Riesgo (IMPORTANTE) */}
        <div style={{...cardStyle, borderLeft: '5px solid #e53e3e'}}>
            <div style={{fontSize:'3rem', fontWeight:'bold', color:'#e53e3e'}}>{stats.enRiesgo.length}</div>
            <div style={{color:'#e53e3e', fontWeight:'bold'}}>En Causal de Eliminación</div>
        </div>

        {/* Promedio */}
        <div style={cardStyle}>
            <div style={{fontSize:'3rem', fontWeight:'bold', color:'#48bb78'}}>{stats.promedioGeneral}</div>
            <div style={{color:'#718096'}}>Promedio General</div>
        </div>
      </div>

      <div style={{display:'flex', gap:'20px', flexWrap:'wrap'}}>
          {/* DETALLE DE RIESGO */}
          <div style={{flex: 1, background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
              <h3 style={{margin:'0 0 15px 0', color:'#e53e3e'}}>⚠️ Estudiantes en Riesgo</h3>
              {stats.enRiesgo.length === 0 ? (
                  <p style={{color:'green'}}>¡Todo limpio! No hay alumnos en causal.</p>
              ) : (
                  <ul style={{paddingLeft:'20px'}}>
                      {stats.enRiesgo.map(email => (
                          <li key={email} style={{marginBottom:'5px', fontWeight:'bold'}}>{email}</li>
                      ))}
                  </ul>
              )}
          </div>

          {/* DATO CURIOSO */}
          <div style={{flex: 1, background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
              <h3 style={{margin:'0 0 15px 0'}}>🔥 Ramo con más reprobaciones</h3>
              <p style={{fontSize:'1.5rem', margin:0}}>{stats.ramoMasDificil}</p>
              <small style={{color:'#718096'}}>Es donde más alumnos se están quedando.</small>
          </div>
      </div>

    </div>
  );
}

const cardStyle = {
    flex: 1, 
    minWidth: '200px', 
    background: 'white', 
    padding: '20px', 
    borderRadius: '10px', 
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    textAlign: 'center'
};