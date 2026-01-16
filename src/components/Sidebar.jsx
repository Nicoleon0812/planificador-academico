export function Sidebar({ catalogo, busqueda, setBusqueda, ramoSeleccionado, onSelectRamo, usuario, onLogout, tema, esMovil, menuAbierto, setMenuAbierto }) {
    const ramosFiltrados = catalogo.filter(r =>
        r.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        r.id.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
    <div style={{ 
        width: esMovil ? '100%' : '300px', 
        height: esMovil ? (menuAbierto ? '50vh' : 'auto') : '100%', 
        padding: '15px', 
        background: tema.sidebar, 
        borderRight: `1px solid ${tema.borde}`, 
        display: 'flex', flexDirection: 'column', 
        zIndex: 10, transition: 'height 0.3s'
      }}>
      
      {/* Cabecera del Sidebar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div>
           <h3 style={{ margin: 0, color: tema.texto }}>Hola, {usuario.split(' ')[0]}</h3>
           <button onClick={onLogout} style={{ border: 'none', background: 'transparent', color: 'red', cursor: 'pointer', fontSize: '0.8rem' }}>(Salir)</button>
        </div>
        {esMovil && (
          <button onClick={() => setMenuAbierto(!menuAbierto)} style={{ background: 'transparent', border: `1px solid ${tema.borde}`, color: tema.texto, padding: '5px' }}>
            {menuAbierto ? '▲' : '▼'} Catálogo
          </button>
        )}
      </div>

      {/* Lista de Ramos */}
      <div style={{ display: (esMovil && !menuAbierto) ? 'none' : 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <input 
          type="text" 
          placeholder="Buscar ramo..." 
          onChange={(e) => setBusqueda(e.target.value)} 
          style={{ padding: '10px', marginBottom: '10px', width: '100%', background: tema.inputFondo, color: tema.inputTexto, border: `1px solid ${tema.borde}`, borderRadius: '4px' }} 
        />
        
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ramosFiltrados.map((ramo) => (
            <div 
              key={ramo.id} 
              onClick={() => onSelectRamo(ramo)} 
              style={{ 
                padding: '10px', 
                background: ramoSeleccionado?.id === ramo.id ? (tema.texto === '#e0e0e0' ? '#0d47a1' : '#cce5ff') : tema.tarjeta, 
                border: ramoSeleccionado?.id === ramo.id ? '2px solid #004085' : `1px solid ${tema.borde}`, 
                borderRadius: '6px', 
                cursor: 'pointer',
                color: tema.texto
              }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{ramo.id}</div>
              <div>{ramo.nombre}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>💎 {ramo.creditos} Créditos</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}