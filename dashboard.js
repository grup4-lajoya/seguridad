// ============================================
// DASHBOARD - SISTEMA DE SEGURIDAD
// ============================================

function obtenerSesion() {
  const sesionGuardada = localStorage.getItem('sesion');
  if (sesionGuardada) {
    const parsed = JSON.parse(sesionGuardada);
    return parsed;
  }
  console.log('❌ No se encontró sesión en localStorage');
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
  
  // Mostrar usuario y cargar módulos
  mostrarInfoUsuario(sesion.usuario);
  cargarModulosSegunRol(sesion.usuario.rol);
  
  console.log('✅ Usuario autenticado:', sesion.usuario.nombre);
  console.log('🎭 Rol:', sesion.usuario.rol);
}

// Mostrar información del usuario en el header
function mostrarInfoUsuario(usuario) {
  document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
  document.getElementById('userUnit').textContent = usuario.unidad || 'Sin unidad';
  
  // Mostrar rol de forma amigable
  const rolesAmigables = {
    'OPERADOR': '🎖️ Comandante de la Guardia',
    'SUPERVISOR': '👔 Jefe de Servicio',
    'ADMIN': '⚙️ Administrador'
  };
  
  const rolTexto = rolesAmigables[usuario.rol] || usuario.rol || 'Usuario';
  document.getElementById('userRole').textContent = rolTexto;
}

// ============================================
// CARGAR MÓDULOS SEGÚN ROL
// ============================================
function cargarModulosSegunRol(rol) {
  console.log('📦 Cargando módulos para rol:', rol);
  
  const modulesGrid = document.getElementById('modulesGrid');
  
  if (!modulesGrid) {
    console.error('❌ No se encontró el elemento modulesGrid');
    return;
  }
  
  // Definir módulos disponibles
  const modulos = {
    controlAccesos: {
      icon: '🔍',
      title: 'Control de Accesos',
      description: 'Registrar ingresos y salidas de personal y vehículos',
      url: 'control-accesos.html',
      roles: ['OPERADOR', 'ADMIN']
    },
    consulta: {
      icon: '📊',
      title: 'Consulta',
      description: 'Consultar personal dentro o fuera de la unidad',
      url: 'consulta.html',
      roles: ['OPERADOR', 'SUPERVISOR', 'ADMIN']
    }
  };
  
  // Filtrar módulos según el rol
  let modulosHTML = '';
  let modulosVisibles = 0;
  
  for (const [key, modulo] of Object.entries(modulos)) {
    if (modulo.roles.includes(rol)) {
      modulosVisibles++;
      modulosHTML += `
        <a href="${modulo.url}" class="module-card">
          <div class="module-icon">${modulo.icon}</div>
          <div class="module-title">${modulo.title}</div>
          <div class="module-description">${modulo.description}</div>
        </a>
      `;
    }
  }
  
  // Si no hay módulos disponibles
  if (modulosVisibles === 0) {
    modulosHTML = `
      <div class="module-card disabled">
        <div class="module-icon">🚫</div>
        <div class="module-title">Sin acceso</div>
        <div class="module-description">
          No tienes permisos para acceder a ningún módulo. Contacta al administrador.
        </div>
      </div>
    `;
  }
  
  modulesGrid.innerHTML = modulosHTML;
  console.log(`✅ ${modulosVisibles} módulo(s) cargado(s) para rol ${rol}`);
}

// Cerrar sesión
function cerrarSesion() {
  if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
    limpiarSesion();
    window.location.href = 'index.html';
  }
}

function limpiarSesion() {
  localStorage.removeItem('sesion');
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
