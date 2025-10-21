// ============================================
// DASHBOARD - SISTEMA DE SEGURIDAD
// ============================================

// Obtener sesión guardada
function obtenerSesion() {
  return window.sessionData || null;
}

// Verificar autenticación
async function verificarAutenticacion() {
  const sesion = obtenerSesion();
  
  if (!sesion || !sesion.token) {
    console.log('❌ No hay sesión activa');
    window.location.href = CONFIG.RUTAS.LOGIN;
    return;
  }

  try {
    // Verificar que la sesión sigue siendo válida
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.VERIFICAR_SESION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sesion.token}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
    });

    const data = await response.json();

    if (!data.valido) {
      console.log('❌ Sesión inválida o expirada');
      limpiarSesion();
      window.location.href = CONFIG.RUTAS.LOGIN;
      return;
    }

    // Mostrar información del usuario
    mostrarInfoUsuario(sesion.usuario);
    console.log('✅ Usuario autenticado:', sesion.usuario.nombre);

  } catch (error) {
    console.error('Error al verificar sesión:', error);
    window.location.href = CONFIG.RUTAS.LOGIN;
  }
}

// Mostrar información del usuario en el header
function mostrarInfoUsuario(usuario) {
  document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
  document.getElementById('userUnit').textContent = usuario.unidad || 'Sin unidad';
  document.getElementById('userRole').textContent = `Rol: ${usuario.rol || 'Vigilante'}`;
}

// Cerrar sesión
function cerrarSesion() {
  if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
    limpiarSesion();
    window.location.href = CONFIG.RUTAS.LOGIN;
  }
}

// Limpiar sesión
function limpiarSesion() {
  window.sessionData = null;
}

// ============================================
// INICIALIZACIÓN
// ============================================
async function init() {
  console.log('🚀 Iniciando dashboard...');
  await verificarAutenticacion();
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
