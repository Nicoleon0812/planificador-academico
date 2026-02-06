import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function CalculadoraNotas({ emailEstudiante, ramo, onClose, modoOscuro }) {
  const [evaluaciones, setEvaluaciones] = useState([]);
  
  // 1. Quitamos 'nombre' del estado, solo nos importa nota y porcentaje
  const [nuevaEval, setNuevaEval] = useState({ nota: '', porcentaje: '' });
  const [cargando, setCargando] = useState(true);

  const bgInput = modoOscuro ? '#2d3748' : '#f7fafc';
  const texto = modoOscuro ? '#e2e8f0' : '#2d3748';

  useEffect(() => {
    cargarNotas();
  }, [ramo]);

  const cargarNotas = async () => {
    const { data } = await supabase
      .from('notas_parciales')
      .select('*')
      .eq('email_estudiante', emailEstudiante)
      .eq('ramo_id', ramo.id)
      .order('id', { ascending: true });
    setEvaluaciones(data || []);
    setCargando(false);
  };

  const agregarNota = async () => {
    // 2. VALIDACIÓN CORREGIDA: Ya no preguntamos por el nombre
    if (!nuevaEval.nota || !nuevaEval.porcentaje) return alert("Faltan datos (Nota o %)");
    
    const notaLimpia = nuevaEval.nota.toString().replace(',', '.');
    
    // 3. AUTO-NOMBRE: Generamos un nombre automático para que la base de datos no quede vacía
    const nombreAutomatico = `Evaluación ${evaluaciones.length + 1}`;

    await supabase.from('notas_parciales').insert({
      email_estudiante: emailEstudiante,
      ramo_id: ramo.id,
      nombre_evaluacion: nombreAutomatico, // Guardamos el nombre automático
      nota: parseFloat(notaLimpia),
      porcentaje: parseInt(nuevaEval.porcentaje)
    });
    
    setNuevaEval({ nota: '', porcentaje: '' });
    cargarNotas();
  };

  const borrarNota = async (id) => {
    await supabase.from('notas_parciales').delete().eq('id', id);
    cargarNotas();
  };

  // --- CÁLCULOS MATEMÁTICOS ---
  const calcularSituacion = () => {
    let sumaPonderada = 0;
    let porcentajeAcumulado = 0;

    evaluaciones.forEach(ev => {
      if (ev.nota) {
        sumaPonderada += ev.nota * (ev.porcentaje / 100);
      }
      porcentajeAcumulado += ev.porcentaje;
    });

    const porcentajeRestante = 100 - porcentajeAcumulado;
    
    let notaNecesaria = 0;
    if (porcentajeRestante > 0) {
        // Fórmula: (NotaObjetivo - LoQueLlevo) / (PorcentajeQueFalta / 100)
        notaNecesaria = (3.95 - sumaPonderada) / (porcentajeRestante / 100);
    }

    return { 
      acumulado: sumaPonderada.toFixed(2), 
      porcentajeTotal: porcentajeAcumulado,
      restante: porcentajeRestante,
      necesaria: notaNecesaria
    };
  };

  const situacion = calcularSituacion();

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      
      {/* ANCHO AJUSTADO A 700px COMO PEDISTE */}
      <div style={{ 
          background: modoOscuro ? '#1a202c' : 'white', 
          padding: '25px', 
          borderRadius: '15px', 
          width: '90%',        
          maxWidth: '700px',   
          color: texto, 
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)' 
      }}>
        
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
           <h3 style={{margin:0}}>🧮 Calculadora: {ramo.nombre}</h3>
           <button onClick={onClose} style={{background:'transparent', border:'none', fontSize:'1.5rem', color: texto, cursor:'pointer'}}>×</button>
        </div>

        {/* LISTA DE NOTAS */}
        <div style={{maxHeight:'200px', overflowY:'auto', marginBottom:'20px'}}>
            {evaluaciones.length === 0 && <p style={{textAlign:'center', opacity:0.6}}>No hay notas registradas.</p>}
            {evaluaciones.map((ev, index) => (
                <div key={ev.id} style={{display:'flex', justifyContent:'space-between', padding:'10px', background: bgInput, marginBottom:'5px', borderRadius:'8px', alignItems:'center'}}>
                    <div style={{flex:1}}>
                        {/* Mostramos "Evaluación 1", "Evaluación 2", etc. */}
                        <div style={{fontWeight:'bold'}}>{ev.nombre_evaluacion || `Evaluación ${index + 1}`}</div>
                        <div style={{fontSize:'0.8rem', opacity:0.8}}>{ev.porcentaje}% Ponderación</div>
                    </div>
                    <div style={{fontWeight:'bold', fontSize:'1.2rem', color: ev.nota >= 4 ? '#48bb78' : '#f56565', marginRight:'15px'}}>
                        {ev.nota || '-'}
                    </div>
                    <button onClick={() => borrarNota(ev.id)} style={{background:'transparent', border:'none', color:'#e53e3e', cursor:'pointer', fontWeight:'bold'}}>×</button>
                </div>
            ))}
        </div>

        {/* AGREGAR NUEVA (SOLO 2 INPUTS AHORA) */}
        <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
            {/* Input Nota */}
            <input 
                type="number" 
                placeholder="Nota (Ej: 5.5)" 
                value={nuevaEval.nota} 
                onChange={e => setNuevaEval({...nuevaEval, nota: e.target.value})} 
                style={{flex:1, padding:'10px', borderRadius:'5px', border:'1px solid #ccc', background: bgInput, color:texto}} 
            />
            {/* Input Porcentaje */}
            <input 
                type="number" 
                placeholder="% (Ej: 30)" 
                value={nuevaEval.porcentaje} 
                onChange={e => setNuevaEval({...nuevaEval, porcentaje: e.target.value})} 
                style={{flex:1, padding:'10px', borderRadius:'5px', border:'1px solid #ccc', background: bgInput, color:texto}} 
            />
            <button onClick={agregarNota} style={{background:'#3182ce', color:'white', border:'none', borderRadius:'5px', padding:'0 20px', cursor:'pointer', fontWeight:'bold', fontSize:'1.2rem'}}>+</button>
        </div>

        {/* RESUMEN FINAL */}
        <div style={{background: modoOscuro ? '#2d3748' : '#ebf8ff', padding:'15px', borderRadius:'10px', border: `1px solid ${modoOscuro ? '#4a5568' : '#bee3f8'}`}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                <span>Porcentaje Evaluado:</span>
                <strong>{situacion.porcentajeTotal}%</strong>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                <span>Nota Ponderada Actual:</span>
                <strong>{situacion.acumulado}</strong>
            </div>
            
            <hr style={{borderColor: modoOscuro ? '#4a5568' : '#bee3f8', margin:'10px 0'}} />
            
            {situacion.porcentajeTotal < 100 ? (
                <div style={{textAlign:'center'}}>
                    <p style={{margin:0, fontSize:'0.9rem'}}>Para aprobar con un 4.0, necesitas promediar en el <strong>{situacion.restante}%</strong> restante:</p>
                    <div style={{fontSize:'2.5rem', fontWeight:'bold', color: situacion.necesaria > 7 ? '#e53e3e' : '#3182ce', marginTop:'5px'}}>
                        {situacion.necesaria > 7 ? '> 7.0 💀' : situacion.necesaria <= 0 ? '¡Ya aprobaste! 🎉' : situacion.necesaria.toFixed(1)}
                    </div>
                    {situacion.necesaria > 7 && <small style={{color:'#e53e3e'}}>Lo siento, matemáticamente es difícil :(</small>}
                </div>
            ) : (
                <div style={{textAlign:'center', fontSize:'1.2rem', fontWeight:'bold', color: parseFloat(situacion.acumulado) >= 4 ? '#48bb78' : '#e53e3e'}}>
                    Nota Final: {situacion.acumulado}
                </div>
            )}
        </div>

      </div>
    </div>
  );
}