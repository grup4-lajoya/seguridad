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
  console.log('📦 Sesión obtenida:', sesion);
  
  if (!sesion || !sesion.token) {
    console.log('❌ No hay sesión activa');
    window.location.href = 'index.html';
    return;
  }

  try {
    console.log('🔵 URL:', CONFIG.EDGE_FUNCTIONS.VERIFICAR_SESION)
    
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.VERIFICAR_SESION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sesion.token}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
    });

    console.log('📥 Response status:', response.status)

    const data = await response.json();
  console.log('📥 Respuesta completa:', data);

     // AGREGAR ALERT AQUÍ
  //alert('RESPUESTA: ' + JSON.stringify(data) + '\n\nRevisa la consola antes de dar OK');

    if (!data.valido) {
      console.log('❌ Sesión inválida según servidor');
      limpiarSesion();
      window.location.href = 'index.html';
      return;
    }

    // Mostrar información del usuario

    console.log('✅ Sesión válida, mostrando info usuario...')
    mostrarInfoUsuario(sesion.usuario);
    console.log('✅ Usuario autenticado:', sesion.usuario.nombre);

  } catch (error) {
    console.error('❌ Error al verificar sesión:', error);
    window.location.href = 'index.html';
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
