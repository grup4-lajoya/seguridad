// ============================================
// MÓDULO DE CONSULTA - SISTEMA DE SEGURIDAD
// ============================================

let datosActuales = null;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Iniciando módulo de consulta...');
  
  verificarAuth();
  inicializarEventos();
  cargarDatos();
});

// ============================================
// VERIFICAR AUTENTICACIÓN
// ============================================
function verificarAuth() {
  const sesion = localStorage.getItem('sesion');
  if (!sesion) {
    console.log('❌ No hay sesión activa');
    window.location.href = 'index.html';
    return;
  }
  console.log('✅ Usuario autenticado');
}

// ============================================
// INICIALIZAR EVENTOS
// ============================================
function inicializarEventos() {
  // Botón refrescar
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', cargarDatos);
  }

  // Headers colapsables
  const headerDentro = document.getElementById('headerDentro');
  const headerFuera = document.getElementById('headerFuera');

  if (headerDentro) {
    headerDentro.addEventListener('click', () => toggleCollapsible('Dentro'));
  }

  if (headerFuera) {
    headerFuera.addEventListener('click', () => toggleCollapsible('Fuera'));
  }

  console.log('✅ Eventos inicializados');
}

// ============================================
// TOGGLE COLAPSABLE
// ============================================
function toggleCollapsible(tipo) {
  const header = document.getElementById(`header${tipo}`);
  const body = document.getElementById(`body${tipo}`);

  if (!header || !body) return;

  const isActive = header.classList.contains('active');

  if (isActive) {
    // Cerrar
    header.classList.remove('active');
    body.style.maxHeight = '0px';
  } else {
    // Abrir
    header.classList.add('active');
    body.style.maxHeight = body.scrollHeight + 'px';
    
    // Ajustar después de un momento por si hay contenido dinámico
    setTimeout(() => {
      body.style.maxHeight = body.scrollHeight + 'px';
    }, 100);
  }
}

// ============================================
// CARGAR DATOS DESDE SUPABASE
// ============================================
async function cargarDatos() {
  try {
    console.log('📡 Cargando datos...');
    mostrarCargando();

    const response = await fetch(CONFIG.EDGE_FUNCTIONS.CONSULTA_PERSONAS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({})
    });

    const resultado = await response.json();
    console.log('📦 Resultado completo:', resultado);
    console.log('📦 Resultado.data:', resultado.data);

    if (!resultado.success) {
      throw new Error(resultado.error || 'Error al cargar datos');
    }

    // La función SQL devuelve un objeto JSON dentro de data
    // Necesitamos extraer el resultado correcto
    let datosFinales = resultado.data;
    
    // Si data es un array con un solo elemento que contiene 'resultado'
    if (Array.isArray(datosFinales) && datosFinales.length > 0 && datosFinales[0].resultado) {
      datosFinales = datosFinales[0].resultado;
      console.log('📦 Datos extraídos de resultado:', datosFinales);
    }
    
    datosActuales = datosFinales;
    console.log('📦 Datos finales a mostrar:', datosActuales);
    mostrarDatos(datosActuales);
    actualizarTimestamp();

    mostrarToast('✅ Datos actualizados correctamente', 'success');

  } catch (error) {
    console.error('❌ Error:', error);
    mostrarToast(error.message, 'error');
    mostrarError();
  }
}

// ============================================
// MOSTRAR DATOS EN LA INTERFAZ
// ============================================
function mostrarDatos(datos) {
  console.log('📊 Mostrando datos:', datos);

  // Actualizar resumen principal
  document.getElementById('totalPersonas').textContent = datos.resumen.total_personas;
  document.getElementById('totalVehiculos').textContent = datos.resumen.total_vehiculos;

  // Actualizar contadores
  document.getElementById('countDentro').textContent = datos.resumen.dentro;
  document.getElementById('countFuera').textContent = datos.resumen.fuera;

  // Actualizar subtítulos
  const subtitleDentro = `Personal: ${datos.dentro.personal.length} • Visitas: ${datos.dentro.visitas_autorizadas.length} • Temporales: ${datos.dentro.temporales.length}`;
  const subtitleFuera = `Personal: ${datos.fuera.personal.length} • Visitas: ${datos.fuera.visitas_autorizadas.length}`;

  document.getElementById('subtitleDentro').textContent = subtitleDentro;
  document.getElementById('subtitleFuera').textContent = subtitleFuera;

  // Mostrar personas dentro
  mostrarPersonasDentro(datos.dentro);

  // Mostrar personas fuera
  mostrarPersonasFuera(datos.fuera);

  console.log('✅ Datos mostrados correctamente');
}

// ============================================
// MOSTRAR PERSONAS DENTRO
// ============================================
function mostrarPersonasDentro(dentro) {
  const container = document.getElementById('contentDentro');
  
  if (!dentro.personal.length && !dentro.visitas_autorizadas.length && !dentro.temporales.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏢</div>
        <div class="empty-state-text">No hay personas dentro de la base</div>
      </div>
    `;
    return;
  }

  let html = '';

  // Personal de la unidad
  if (dentro.personal.length > 0) {
    html += crearSeccionPersonas(
      'Personal de la Unidad',
      dentro.personal.length,
      dentro.personal,
      'personal'
    );
  }

  // Visitas autorizadas
  if (dentro.visitas_autorizadas.length > 0) {
    html += crearSeccionPersonas(
      'Visitas Autorizadas',
      dentro.visitas_autorizadas.length,
      dentro.visitas_autorizadas,
      'visita'
    );
  }

  // Temporales
  if (dentro.temporales.length > 0) {
    html += crearSeccionPersonas(
      'Ingresos Temporales',
      dentro.temporales.length,
      dentro.temporales,
      'temporal'
    );
  }

  container.innerHTML = html;

  // Agregar eventos de click a las secciones
  agregarEventosSeccion();
}

// ============================================
// MOSTRAR PERSONAS FUERA
// ============================================
function mostrarPersonasFuera(fuera) {
  const container = document.getElementById('contentFuera');
  
  if (!fuera.personal.length && !fuera.visitas_autorizadas.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏠</div>
        <div class="empty-state-text">Todo el personal está dentro</div>
      </div>
    `;
    return;
  }

  let html = '';

  // Personal fuera
  if (fuera.personal.length > 0) {
    html += crearSeccionPersonas(
      'Personal de la Unidad',
      fuera.personal.length,
      fuera.personal,
      'personal',
      false
    );
  }

  // Visitas fuera
  if (fuera.visitas_autorizadas.length > 0) {
    html += crearSeccionPersonas(
      'Visitas Autorizadas',
      fuera.visitas_autorizadas.length,
      fuera.visitas_autorizadas,
      'visita',
      false
    );
  }

  container.innerHTML = html;

  // Agregar eventos de click a las secciones
  agregarEventosSeccion();
}

// ============================================
// CREAR SECCIÓN DE PERSONAS
// ============================================
function crearSeccionPersonas(titulo, cantidad, personas, tipo, mostrarDetalles = true) {
  const sectionId = `section-${tipo}-${Date.now()}-${Math.random()}`;
  const listId = `list-${sectionId}`;

  let html = `
    <div class="person-section">
      <div class="section-header" data-target="${listId}">
        <div class="section-title">${titulo}</div>
        <div class="section-count">${cantidad}</div>
      </div>
      <div class="person-list" id="${listId}">
  `;

  personas.forEach(persona => {
    html += crearItemPersona(persona, tipo, mostrarDetalles);
  });

  html += `
      </div>
    </div>
  `;

  return html;
}

// ============================================
// CREAR ITEM DE PERSONA
// ============================================
function crearItemPersona(persona, tipo, mostrarDetalles) {
  let detalles = '';
  let badges = '';

  if (tipo === 'personal') {
    detalles = `
      <span class="detail-badge">NSA: ${persona.nsa || 'N/A'}</span>
      <span class="detail-badge">DNI: ${persona.dni || 'N/A'}</span>
    `;
    
    if (mostrarDetalles && persona.vehiculo) {
      badges = `<span class="badge badge-vehiculo">🚗 ${persona.vehiculo}</span>`;
    }
  } else if (tipo === 'visita') {
    detalles = `
      <span class="detail-badge">${persona.origen || 'Foráneo'}</span>
      ${persona.dni ? `<span class="detail-badge">DNI: ${persona.dni}</span>` : ''}
    `;
    
    if (mostrarDetalles && persona.vehiculo) {
      badges = `<span class="badge badge-vehiculo">🚗 ${persona.vehiculo}</span>`;
    }
    
    if (persona.fecha_vencimiento) {
      const fechaVenc = new Date(persona.fecha_vencimiento);
      const hoy = new Date();
      const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
      
      if (diasRestantes < 0) {
        badges += ` <span class="badge badge-vencido">⚠️ Vencido</span>`;
      } else if (diasRestantes <= 7) {
        badges += ` <span class="badge badge-temporal">⚠️ Vence pronto</span>`;
      }
    }
  } else if (tipo === 'temporal') {
    detalles = `
      <span class="detail-badge">${persona.empresa || 'Sin empresa'}</span>
      ${persona.dni ? `<span class="detail-badge">DNI: ${persona.dni}</span>` : ''}
    `;
    badges = `<span class="badge badge-temporal">⚠️ TEMPORAL</span>`;
    
    if (mostrarDetalles && persona.vehiculo) {
      badges += ` <span class="badge badge-vehiculo">🚗 ${persona.vehiculo}</span>`;
    }
  }

  return `
    <div class="person-item">
      <div class="person-name">${persona.nombre}</div>
      <div class="person-details">
        ${detalles}
        ${badges}
      </div>
    </div>
  `;
}

// ============================================
// AGREGAR EVENTOS A SECCIONES
// ============================================
function agregarEventosSeccion() {
  const headers = document.querySelectorAll('.section-header');
  
  headers.forEach(header => {
    header.addEventListener('click', function() {
      const targetId = this.getAttribute('data-target');
      const list = document.getElementById(targetId);
      
      if (list) {
        list.classList.toggle('expanded');
      }
    });
  });
}

// ============================================
// MOSTRAR ESTADOS DE CARGA
// ============================================
function mostrarCargando() {
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.disabled = true;
    btnRefresh.innerHTML = '<span class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></span> Actualizando...';
  }
}

function mostrarError() {
  document.getElementById('contentDentro').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">❌</div>
      <div class="empty-state-text">Error al cargar los datos. Intenta nuevamente.</div>
    </div>
  `;

  document.getElementById('contentFuera').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">❌</div>
      <div class="empty-state-text">Error al cargar los datos. Intenta nuevamente.</div>
    </div>
  `;

  habilitarBotonRefresh();
}

function habilitarBotonRefresh() {
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.disabled = false;
    btnRefresh.innerHTML = '<span>🔄</span> Actualizar';
  }
}

// ============================================
// ACTUALIZAR TIMESTAMP
// ============================================
function actualizarTimestamp() {
  const ahora = new Date();
  const hora = ahora.toLocaleTimeString('es-PE', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  document.getElementById('lastUpdate').textContent = `⏱️ Última actualización: ${hora}`;
  habilitarBotonRefresh();
}

// ============================================
// SISTEMA DE TOASTS
// ============================================
function mostrarToast(mensaje, tipo = 'info') {
  const container = document.getElementById('toastContainer');
  
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensaje;
  
  container.appendChild(toast);
  
  const duracion = tipo === 'error' ? 5000 : 3000;
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(400px)';
    setTimeout(() => toast.remove(), 300);
  }, duracion);
}

// ============================================
// LOG INICIAL
// ============================================
console.log('✅ consulta.js cargado correctamente');
