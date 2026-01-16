export function Toolbar({ creditos, modoOscuro, setModoOscuro, onLimpiar, onExportarExcel, onExportarFoto, tema, esMovil }) {
    return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '10px', borderBottom: `2px solid ${tema.borde}`, gap: '10px' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem' }}>📅Calendario Académico</h1>
      
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
         {/* Contador Créditos */}
         <div style={{ padding: '5px 10px', background: creditos > 40 ? '#dc3545' : '#28a745', color: 'white', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.8rem' }}>
            {creditos}/40
         </div>

         {/* Switch Tema */}
         <button onClick={() => setModoOscuro(!modoOscuro)} style={{ background: 'transparent', border: `1px solid ${tema.borde}`, fontSize: '1rem', padding: '5px', borderRadius: '6px', cursor: 'pointer' }}>
            {modoOscuro ? '☀️' : '🌙'}
         </button>

         {/* Botones Acciones */}
         <button onClick={onLimpiar} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}>🗑️</button>
         {!esMovil && <button onClick={onExportarExcel} style={{ background: '#217346', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}>Excel</button>}
         <button onClick={onExportarFoto} style={{ background: '#7b1fa2', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}>📷 Foto</button>
      </div>
    </div>
  )
}

