import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function CalendarioEventos({ emailEstudiante, modoOscuro }) {
  const [fechaActual, setFechaActual] = useState(new Date());
  const [eventos, setEventos] = useState([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [nuevoEvento, setNuevoEvento] = useState({ titulo: '', tipo: 'prueba' });

  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  // Colores según modo oscuro
  const tema = {
    fondo: modoOscuro ? '#2d2d2d' : 'white',
    texto: modoOscuro ? '#e0e0e0' : '#333',
    borde: modoOscuro ? '#444' : '#ddd',
    hover: modoOscuro ? '#3a3a3a' : '#f9f9f9'
  };

  useEffect(() => {
    if (emailEstudiante) cargarEventos();
  }, [fechaActual, emailEstudiante]);

  const cargarEventos = async () => {
    const primerDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1).toISOString();
    const ultimoDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0).toISOString();

    const { data } = await supabase
      .from('eventos_calendario')
      .select('*')
      .eq('email_estudiante', emailEstudiante)
      .gte('fecha', primerDia)
      .lte('fecha', ultimoDia);

    setEventos(data || []);
  };

  const agregarEvento = async () => {
    if (!nuevoEvento.titulo) return;
    const fechaSQL = `${fechaActual.getFullYear()}-${fechaActual.getMonth() + 1}-${diaSeleccionado}`;
    
    await supabase.from('eventos_calendario').insert({
      titulo: nuevoEvento.titulo,
      tipo: nuevoEvento.tipo,
      fecha: fechaSQL,
      email_estudiante: emailEstudiante
    });
    setDiaSeleccionado(null);
    setNuevoEvento({ titulo: '', tipo: 'prueba' });
    cargarEventos();
  };

  const borrarEvento = async (id) => {
    if(!window.confirm("¿Borrar?")) return;
    await supabase.from('eventos_calendario').delete().eq('id', id);
    cargarEventos();
  };

  const cambiarMes = (n) => setFechaActual(new Date(fechaActual.getFullYear(), fechaActual.getMonth() + n, 1));
  
  // Cálculos de calendario
  const diasEnMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0).getDate();
  const primerDiaSemana = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1).getDay(); // 0 Dom - 6 Sab
  const offset = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1; // Ajuste Lunes=0

  const arrayDias = Array(offset).fill(null).concat([...Array(diasEnMes).keys()].map(x => x + 1));

  const getColor = (tipo) => {
    if(tipo === 'prueba') return '#e53e3e';
    if(tipo === 'trabajo') return '#3182ce';
    return '#38a169';
  };

  return (
    <div style={{ padding: '20px', color: tema.texto, maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => cambiarMes(-1)} style={{padding:'5px 15px', cursor:'pointer'}}>◀</button>
        <h2 style={{margin:0}}>{meses[fechaActual.getMonth()]} {fechaActual.getFullYear()}</h2>
        <button onClick={() => cambiarMes(1)} style={{padding:'5px 15px', cursor:'pointer'}}>▶</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => <div key={d} style={{fontWeight:'bold', textAlign:'center'}}>{d}</div>)}
        
        {arrayDias.map((dia, i) => {
          if(!dia) return <div key={i}></div>;
          const fechaKey = `${fechaActual.getFullYear()}-${String(fechaActual.getMonth()+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`; // YYYY-MM-DD
          // Corrección importante: Comparar fechas correctamente ignorando hora
          const misEventos = eventos.filter(e => e.fecha === fechaKey);

          return (
            <div key={i} onClick={() => setDiaSeleccionado(dia)} 
              style={{
                minHeight: '80px', border: `1px solid ${tema.borde}`, borderRadius: '8px', padding: '5px', 
                backgroundColor: tema.fondo, cursor: 'pointer', position: 'relative'
              }}>
              <div style={{fontWeight:'bold', marginBottom:'5px'}}>{dia}</div>
              {misEventos.map(ev => (
                <div key={ev.id} style={{fontSize:'0.7rem', backgroundColor: getColor(ev.tipo), color:'white', padding:'2px', borderRadius:'3px', marginBottom:'2px', display:'flex', justifyContent:'space-between'}}>
                  <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{ev.titulo}</span>
                  <span onClick={(e)=>{e.stopPropagation(); borrarEvento(ev.id)}} style={{fontWeight:'bold', cursor:'pointer'}}>×</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {diaSeleccionado && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000}}>
          <div style={{background: tema.fondo, padding:'20px', borderRadius:'10px', width:'300px', border: `1px solid ${tema.borde}`}}>
            <h3>Evento el {diaSeleccionado}</h3>
            <input type="text" placeholder="Título..." value={nuevoEvento.titulo} onChange={e=>setNuevoEvento({...nuevoEvento, titulo:e.target.value})} style={{width:'100%', padding:'8px', marginBottom:'10px'}} autoFocus />
            <select value={nuevoEvento.tipo} onChange={e=>setNuevoEvento({...nuevoEvento, tipo:e.target.value})} style={{width:'100%', padding:'8px', marginBottom:'15px'}}>
              <option value="prueba">🔴 Prueba</option>
              <option value="trabajo">🔵 Trabajo</option>
              <option value="personal">🟢 Personal</option>
            </select>
            <div style={{display:'flex', gap:'10px'}}>
              <button onClick={agregarEvento} style={{flex:1, padding:'8px', background:'#3182ce', color:'white', border:'none', cursor:'pointer'}}>Guardar</button>
              <button onClick={()=>setDiaSeleccionado(null)} style={{flex:1, padding:'8px', cursor:'pointer'}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}