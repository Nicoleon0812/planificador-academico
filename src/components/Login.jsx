// src/components/Login.jsx
import { useState } from 'react'
import { supabase } from '../supabase'

// 1. AÑADIMOS "modoOscuro" y "setModoOscuro" AQUÍ
export function Login({ onLogin, tema, modoOscuro, setModoOscuro }) {
  const [emailInput, setEmailInput] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailInput) return setError("Escribe tu correo.");
    
    const correo = emailInput.trim().toLowerCase();
    
    const { data, error } = await supabase
      .from('lista_blanca')
      .select('email, nombre')
      .eq('email', correo)
      .maybeSingle();

    if (error || !data) {
      setError("⛔ Acceso denegado: No estás en la lista.");
      return;
    }

    onLogin(data.email, data.nombre);
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      background: tema.fondo, 
      zIndex: 9999 
    }}>
      
      {/* --- BOTÓN DE TEMA (FLOTANTE EN LA ESQUINA) --- */}
      <button 
        onClick={() => setModoOscuro(!modoOscuro)} 
        style={{ 
          position: 'absolute', 
          top: '20px', 
          right: '20px', 
          background: 'transparent', 
          border: `1px solid ${tema.borde}`, 
          fontSize: '1.5rem', 
          padding: '5px 10px', 
          borderRadius: '8px', 
          cursor: 'pointer', 
          color: tema.texto,
          transition: 'transform 0.2s'
        }}
        onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
      >
        {modoOscuro ? '☀️' : '🌙'}
      </button>

      {/* --- TARJETA DE LOGIN --- */}
      <div style={{ 
        background: tema.tarjeta, 
        padding: '40px', 
        borderRadius: '15px', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
        width: '350px', 
        maxWidth: '90%', 
        height: 'auto', 
        border: `1px solid ${tema.borde}`, 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
      }}>
        
        <div>
           <h1 style={{ color: tema.texto, margin: '0 0 10px 0', fontSize: '1.8rem' }}>🎓</h1>
           <h2 style={{ color: tema.texto, margin: 0, fontSize: '1.5rem' }}>Acceso Estudiantes</h2>
        </div>
        
        <p style={{ color: tema.textoSecundario, margin: 0, fontSize: '0.9rem' }}>
          Tu horario se guardará automáticamente.
        </p>
        
        <form onSubmit={handleSubmit} style={{ width: '100%', marginTop: '10px' }}>
          <input 
            type="email" 
            placeholder="Ingresa tu correo UCM..." 
            value={emailInput} 
            onChange={(e) => setEmailInput(e.target.value)} 
            style={{ 
              width: '100%', 
              padding: '12px', 
              background: tema.inputFondo, 
              color: tema.inputTexto, 
              border: `1px solid ${tema.borde}`, 
              borderRadius: '8px',
              outline: 'none',
              boxSizing: 'border-box'
            }} 
          />
          
          {error && (
            <div style={{ color: '#721c24', backgroundColor: '#f8d7da', padding: '10px', borderRadius: '5px', fontSize: '0.85rem', marginTop: '10px', border: '1px solid #f5c6cb' }}>
              {error}
            </div>
          )}

          <button type="submit" style={{ width: '100%', padding: '12px', background: '#0056b3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '15px', fontSize: '1rem' }}>
            Ingresar
          </button>
        </form>

      </div>
    </div>
  )
}