// ============================================
// DASHBOARD - SISTEMA DE SEGURIDAD
// ============================================

function obtenerSesion() {
  const sesionGuardada = localStorage.getItem('sesion');
   if (sesionGuardada) {
    const parsed = JSON.parse(sesionGuardada)
      return parsed;
  }
  console.log('❌ No se encontró sesión en localStorage')
  return null;
}

// Verificar autenticación
async function verificarAutenticacion() {
  console.log('🔍 Verificando autenticación...');
  
  const sesion = obtenerSesion();
  
  if (!sesion || !sesion.token) {
    console.log('❌ No hay sesión activa');
    window.location.href = 'index.html';
    return;
  }

  // Verificar que la sesión no haya expirado (24 horas)
  const ahora = Date.now();
  const tiempoTranscurrido = ahora - sesion.timestamp;
  const VEINTICUATRO_HORAS = 24 * 60 * 60 * 1000;
  
  if (tiempoTranscurrido > VEINTICUATRO_HORAS) {
    console.log('❌ Sesión expirada');
    limpiarSesion();
    window.location.href = 'index.html';
    return;
  }

  // Mostrar usuario
  mostrarInfoUsuario(sesion.usuario);
  console.log('✅ Usuario autenticado:', sesion.usuario.nombre);
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
    window.location.href = 'index.html';  
  }
}
function limpiarSesion() {
  localStorage.removeItem('sesion');  // Cambiar a localStorage
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
