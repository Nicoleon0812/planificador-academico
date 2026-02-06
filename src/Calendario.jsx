import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import * as XLSX from 'xlsx'
import html2canvas from 'html2canvas'

// Importamos tus componentes
import { Login } from './components/Login'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { Grilla } from './components/Grilla'
import { PanelAdmin } from './components/PanelAdmin'

// 👇 IMPORTAMOS EL NUEVO COMPONENTE DE EVENTOS 👇
import { CalendarioEventos } from './components/CalendarioEventos'

// --- CONSTANTES ---
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const BLOQUES = ['08:30 - 09:30', '09:35 - 10:35', '10:50 - 11:50', '11:55 - 12:55', '13:10 - 14:10', '14:30 - 15:30', '15:35 - 16:35', '16:50 - 17:50', '17:55 - 18:55'];
const PALETA = ['#FFCDD2', '#F8BBD0', '#E1BEE7', '#D1C4E9', '#C5CAE9', '#BBDEFB', '#B3E5FC', '#B2EBF2', '#B2DFDB', '#C8E6C9', '#DCEDC8', '#FFF9C4', '#FFECB3', '#FFE0B2', '#D7CCC8', '#F5F5F5'];

const EMAIL_CECILIA = 'cmendoza@ucm.cl';
const EMAIL_NICOLAS = 'nicolas.leon@alumnos.ucm.cl'; 

function Calendario() {
  // --- ESTADOS ---
  const [esMovil, setEsMovil] = useState(window.innerWidth < 768);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  
  // Estado para cambiar entre "Horario Semanal" y "Calendario Mensual"
  const [modoVista, setModoVista] = useState('semanal'); // 'semanal' | 'mensual'

  // Tema Oscuro
  const [modoOscuro, setModoOscuro] = useState(() => 
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setModoOscuro(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  const [usuario, setUsuario] = useState(null)
  const [nombreUsuario, setNombreUsuario] = useState(null)
  
  // --- ESTADOS DE ADMINISTRACIÓN 🔐 ---
  const [esAdmin, setEsAdmin] = useState(false); 
  const [mostrarModalClave, setMostrarModalClave] = useState(false); 
  const [inputClave, setInputClave] = useState("");

  const [catalogoRamos, setCatalogoRamos] = useState([])
  const [busqueda, setBusqueda] = useState("")
  const [ramoSeleccionado, setRamoSeleccionado] = useState(null)
  const [horarioArmado, setHorarioArmado] = useState([])
  const [creditosTotales, setCreditosTotales] = useState(0)

  // --- TEMA ---
  const tema = {
    fondo: modoOscuro ? '#121212' : '#f0f2f5',
    sidebar: modoOscuro ? '#1e1e1e' : '#f8f9fa',
    texto: modoOscuro ? '#e0e0e0' : '#2c3e50',
    textoSecundario: modoOscuro ? '#aaaaaa' : '#666',
    tarjeta: modoOscuro ? '#2d2d2d' : 'white',
    borde: modoOscuro ? '#444' : '#ddd',
    inputFondo: modoOscuro ? '#333' : 'white',
    inputTexto: modoOscuro ? 'white' : 'black',
    tablaHeader: modoOscuro ? '#333' : '#e9ecef',
    bloqueLabel: modoOscuro ? '#252525' : '#f8f9fa'
  };

  // --- DETECTOR TAMAÑO ---
  useEffect(() => {
    const handleResize = () => setEsMovil(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- CARGA INICIAL ---
  useEffect(() => {
    async function getAsignaturas() {
      const { data } = await supabase.from('asignaturas').select('*').order('id')
      if (data) setCatalogoRamos(data)
    }
    getAsignaturas()
  }, [])

  useEffect(() => {
    if (usuario && catalogoRamos.length > 0) cargarHorarioGuardado();
  }, [usuario, catalogoRamos])

  // --- SEGURIDAD AUTOMÁTICA (CECILIA) ---
  useEffect(() => {
    if (usuario === EMAIL_CECILIA) {
      setMostrarModalClave(true); 
    }
  }, [usuario]);

  // --- VALIDAR CLAVE ---
  const manejarIntentoAcceso = (e) => {
    e.preventDefault();
    if (inputClave === import.meta.env.VITE_ADMIN_PASSWORD) {
      setEsAdmin(true);
      setMostrarModalClave(false);
      setInputClave("");
    } else {
      alert("⛔ Clave Incorrecta");
      setInputClave("");
    }
  };

  // --- LÓGICA DE NEGOCIO ---
  async function cargarHorarioGuardado() {
    const { data } = await supabase.from('mis_horarios').select('*').eq('email', usuario)
    if (data) {
      let creditos = 0;
      const reconstruido = data.map(item => {
        const ramo = catalogoRamos.find(r => r.id === item.ramo_id);
        return { id_unico: item.id, ramo, dia: item.dia, bloque: item.bloque };
      }).filter(i => i.ramo);

      const unicos = [...new Set(reconstruido.map(h => h.ramo.id))];
      unicos.forEach(id => {
         const r = catalogoRamos.find(c => c.id === id);
         if (r) creditos += r.creditos;
      });
      
      setHorarioArmado(reconstruido);
      setCreditosTotales(creditos);
    }
  }

  const colocarEnCelda = async (dia, bloque) => {
    if (!ramoSeleccionado) return;
    const enCelda = horarioArmado.filter(h => h.dia === dia && h.bloque === bloque);
    if (enCelda.length >= 2) return alert("⚠️ Máximo 2 ramos por bloque.");
    if (enCelda.some(h => h.ramo.id === ramoSeleccionado.id)) return;

    const yaEstaba = horarioArmado.some(h => h.ramo.id === ramoSeleccionado.id);
    if (!yaEstaba) {
       if (creditosTotales + ramoSeleccionado.creditos > 35) return alert("⚠️ Límite de créditos excedido.");
       setCreditosTotales(creditosTotales + ramoSeleccionado.creditos);
    }

    const { data, error } = await supabase.from('mis_horarios').insert({ email: usuario, ramo_id: ramoSeleccionado.id, dia, bloque }).select();
    if (!error) {
       setHorarioArmado([...horarioArmado, { id_unico: data[0].id, ramo: ramoSeleccionado, dia, bloque }]);
    }
  }

  const quitarDeCelda = async (item) => {
    const { error } = await supabase.from('mis_horarios').delete().eq('id', item.id_unico);
    if (!error) {
       const nuevo = horarioArmado.filter(i => i.id_unico !== item.id_unico);
       setHorarioArmado(nuevo);
       if (!nuevo.some(i => i.ramo.id === item.ramo.id)) {
          setCreditosTotales(creditosTotales - item.ramo.creditos);
       }
    }
  }

  const limpiarTodo = async () => {
     if(!window.confirm("¿Borrar todo?")) return;
     await supabase.from('mis_horarios').delete().eq('email', usuario);
     setHorarioArmado([]);
     setCreditosTotales(0);
  }

  // --- EXPORTACIONES ---
  const exportarExcel = () => {
    const datos = BLOQUES.map(bloque => {
      const fila = { Horario: bloque };
      DIAS.forEach(dia => {
        const items = horarioArmado.filter(h => h.dia === dia && h.bloque === bloque);
        fila[dia] = items.map(i => i.ramo.nombre).join(' / ');
      });
      return fila;
    });
    const libro = XLSX.utils.book_new();
    const hoja = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.book_append_sheet(libro, hoja, "Horario");
    XLSX.writeFile(libro, `Horario_${nombreUsuario}.xlsx`);
  }

  const exportarImagen = async () => {
    const original = document.getElementById('horario-screenshot');
    if (!original) return;
    const clone = original.cloneNode(true);
    Object.assign(clone.style, {
        position: 'absolute', top: '0', left: '-9999px', width: '1500px', zIndex: '-1',
        background: tema.tarjeta, color: tema.texto
    });
    const thead = clone.querySelector('thead');
    if(thead) { thead.style.position = 'static'; }
    const table = clone.querySelector('table');
    if(table) { table.style.width = '100%'; table.style.tableLayout = 'fixed'; }

    document.body.appendChild(clone);
    try {
        const canvas = await html2canvas(clone, { scale: 2, backgroundColor: tema.tarjeta });
        const link = document.createElement('a');
        link.download = `Horario_${nombreUsuario}.png`;
        link.href = canvas.toDataURL();
        link.click();
    } catch(e) { console.error(e); alert("Error al exportar imagen"); } 
    finally { document.body.removeChild(clone); }
  }

  const obtenerColor = (nombre) => {
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    return PALETA[Math.abs(hash) % PALETA.length];
  };

  // --- RENDERIZADO PRINCIPAL ---
  if (!usuario) return (
    <Login 
      onLogin={(email, nombre) => { setUsuario(email); setNombreUsuario(nombre); }} 
      tema={tema} 
      modoOscuro={modoOscuro}
      setModoOscuro={setModoOscuro}
    />
  );

  return (
    <div className={modoOscuro ? "dark-mode" : ""} style={{ display: 'flex', flexDirection: esMovil ? 'column' : 'row', height: '100vh', width: '100vw', fontFamily: 'Segoe UI', background: tema.fondo, color: tema.texto }}>
      
      {/* 🔐 MODAL DE CONTRASEÑA */}
      {mostrarModalClave && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Acceso Administrativo</h2>
            <p>Este modo requiere credenciales de Secretario/a.</p>
            <form onSubmit={manejarIntentoAcceso}>
              <input 
                type="password" 
                className="input-clave"
                placeholder="Ingrese Clave Maestra"
                value={inputClave}
                onChange={(e) => setInputClave(e.target.value)}
                autoFocus
              />
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button type="submit" className="btn-acceder">Entrar</button>
                {usuario !== EMAIL_CECILIA && (
                  <button type="button" className="btn-cancelar" onClick={() => setMostrarModalClave(false)}>Cancelar</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔘 BOTÓN FLOTANTE SOLO PARA NICOLÁS */}
      {usuario === EMAIL_NICOLAS && !esAdmin && (
        <button 
          className="btn-flotante-admin" 
          onClick={() => setMostrarModalClave(true)}
          title="Activar Modo Edición"
        >
          ⚙️
        </button>
      )}

      {/* --- CONTENIDO PRINCIPAL --- */}
      {esAdmin ? (
        <PanelAdmin 
           catalogo={catalogoRamos} 
           onSalir={() => setEsAdmin(false)} 
           modoOscuro={modoOscuro}
        />
      ) : (
        // VISTA ESTUDIANTE NORMAL
        <>
          <Sidebar 
            catalogo={catalogoRamos} 
            busqueda={busqueda} 
            setBusqueda={setBusqueda}
            ramoSeleccionado={ramoSeleccionado}
            onSelectRamo={(r) => setRamoSeleccionado(ramoSeleccionado?.id === r.id ? null : r)}
            usuario={nombreUsuario}
            onLogout={() => { setUsuario(null); setNombreUsuario(null); setEsAdmin(false); }}
            tema={tema}
            esMovil={esMovil}
            menuAbierto={menuMovilAbierto}
            setMenuAbierto={setMenuMovilAbierto}
          />

          <div style={{ flex: 1, padding: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            
            {/* HERRAMIENTAS (TOOLBAR) - SOLO VISIBLE EN MODO SEMANAL */}
            {modoVista === 'semanal' && (
              <Toolbar 
                 creditos={creditosTotales}
                 modoOscuro={modoOscuro}
                 setModoOscuro={setModoOscuro}
                 onLimpiar={limpiarTodo}
                 onExportarExcel={exportarExcel}
                 onExportarFoto={exportarImagen}
                 tema={tema}
                 esMovil={esMovil}
              />
            )}

            {/* 👇 SELECTOR DE VISTAS (PESTAÑAS) 👇 */}
            <div style={{display: 'flex', gap: '10px', margin: '0 0 10px 10px'}}>
               <button 
                  onClick={() => setModoVista('semanal')}
                  style={{
                    padding: '8px 20px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
                    backgroundColor: modoVista === 'semanal' ? '#3182ce' : tema.tarjeta,
                    color: modoVista === 'semanal' ? 'white' : tema.texto,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
               >
                 📅 Horario Semanal
               </button>
               <button 
                  onClick={() => setModoVista('mensual')}
                  style={{
                    padding: '8px 20px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
                    backgroundColor: modoVista === 'mensual' ? '#e53e3e' : tema.tarjeta,
                    color: modoVista === 'mensual' ? 'white' : tema.texto,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
               >
                 🗓️ Calendario Eventos
               </button>
            </div>

            {/* 👇 CONTENIDO SEGÚN VISTA 👇 */}
            {modoVista === 'semanal' ? (
                <Grilla 
                   horario={horarioArmado}
                   bloques={BLOQUES}
                   dias={DIAS}
                   onCeldaClick={colocarEnCelda}
                   onQuitarRamo={quitarDeCelda}
                   ramoSeleccionado={ramoSeleccionado}
                   obtenerColor={obtenerColor}
                   tema={tema}
                />
            ) : (
                <div style={{flex: 1, overflowY: 'auto', background: tema.tarjeta, borderRadius: '8px', padding: '10px'}}>
                   <CalendarioEventos emailEstudiante={usuario} modoOscuro={modoOscuro} />
                </div>
            )}
            
          </div>
        </>
      )}
    </div>
  )
}

export default Calendario