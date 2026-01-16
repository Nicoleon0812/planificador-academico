// src/components/Grilla.jsx
export function Grilla({ horario, bloques, dias, onCeldaClick, onQuitarRamo, ramoSeleccionado, obtenerColor, tema }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', background: tema.tarjeta, borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      {/* ID necesario para la foto */}
      <div id="horario-screenshot" style={{ minWidth: '800px', padding: '10px', background: tema.tarjeta }}> 
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          
          <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
            <tr>
              <th style={{ background: tema.tablaHeader, padding: '12px', border: `1px solid ${tema.borde}`, color: tema.texto, minWidth: '80px' }}>Bloque</th>
              {dias.map(d => <th key={d} style={{ background: tema.tablaHeader, padding: '12px', border: `1px solid ${tema.borde}`, width: '14%', color: tema.texto }}>{d}</th>)}
            </tr>
          </thead>

          <tbody>
            {bloques.map((bloque) => (
              <tr key={bloque}>
                <td style={{ padding: '8px', border: `1px solid ${tema.borde}`, fontWeight: 'bold', textAlign: 'center', background: tema.bloqueLabel, color: tema.texto }}>{bloque}</td>
                
                {dias.map(dia => {
                  const items = horario.filter(h => h.dia === dia && h.bloque === bloque);
                  return (
                    <td key={dia} onClick={() => onCeldaClick(dia, bloque)} style={{ border: `1px solid ${tema.borde}`, height: '85px', verticalAlign: 'top', padding: '4px', cursor: ramoSeleccionado ? 'cell' : 'default', background: items.length > 0 ? tema.tarjeta : 'transparent' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {items.map(item => (
                          <div key={item.id_unico} style={{ background: obtenerColor(item.ramo.nombre), padding: '4px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#444' }}>{item.ramo.id}</div>
                              <div style={{ fontSize: '0.75rem', lineHeight: '1.1', color: '#222' }}>{item.ramo.nombre}</div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); onQuitarRamo(item); }} style={{ background: 'transparent', border: 'none', color: '#444', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.2rem', lineHeight: '0.5' }}>×</button>
                          </div>
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}