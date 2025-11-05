// Elementos del DOM (se inicializan después de cargar el DOM)
let html5QrCodeScanner = null;
let elements = {};
let modoRutinasActivo = false;
let flashActivado = false;  // ← NUEVO
let streamActual = null;     // ← NUEVO
let listaPaises = [];
let listaDependencias = [];

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  // ✅ INICIAR EN MODO CENTRADO
  document.body.classList.add('modo-centrado');
  
  elements = {
    inputCodigo: document.getElementById('inputCodigo'),
    btnBuscar: document.getElementById('btnBuscar'),
    btnLimpiar: document.getElementById('btnLimpiar'),
    resultado: document.getElementById('resultado'),
    alerta: document.getElementById('alerta')
  };
  
  console.log('✅ Elementos inicializados:', elements);
  
  // Event listeners
  if (elements.btnBuscar) {
    elements.btnBuscar.addEventListener('click', () => buscarCodigo());
  }
  
  if (elements.inputCodigo) {
    elements.inputCodigo.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') buscarCodigo();
    });
  }
  
  if (elements.btnLimpiar) {
    elements.btnLimpiar.addEventListener('click', limpiarResultado);
  }
  
  const btnEscanearDNI = document.getElementById('btnEscanearDNI');
  if (btnEscanearDNI) {
    btnEscanearDNI.addEventListener('click', iniciarEscanerCodigo);
  }
  
  const btnEscanearPlaca = document.getElementById('btnEscanearPlaca');
  if (btnEscanearPlaca) {
    btnEscanearPlaca.addEventListener('click', () => {
      iniciarEscanerPlaca((placa) => { 
        elements.inputCodigo.value = placa; 
        buscarCodigo(); 
      });
    });
  }

  const btnModoRutinas = document.getElementById('btnModoRutinas');
  if (btnModoRutinas) {
    btnModoRutinas.addEventListener('click', toggleModoRutinas);
  }
  
  verificarAuth();
  
  // ✅ CARGAR DATOS INICIALES
  cargarPaises();
  cargarDependencias();
  
  elements.inputCodigo.focus();
});

// ============================================
// FUNCIONES DE DETECCIÓN
// ============================================
function detectarTipoCodigo(codigo) {
  const limpio = codigo.trim().toUpperCase();
  
  // Solo dígitos
  if (/^\d+$/.test(limpio)) {
    if (limpio.length >= 5 && limpio.length <= 6) {
      return { tipo: 'nsa', valor: limpio };
    }
    if (limpio.length === 8) {
      return { tipo: 'dni', valor: limpio };
    }
    // ✅ NUEVO: Soportar pasaportes/carnets numéricos largos
    if (limpio.length > 8 && limpio.length <= 20) {
      return { tipo: 'dni', valor: limpio }; // Lo tratamos como documento
    }
  }
  
  // Alfanumérico corto (placa)
  if (/^[A-Z0-9-]{5,7}$/.test(limpio)) {
    return { tipo: 'placa', valor: limpio };
  }
  
  // ✅ NUEVO: Alfanumérico largo (pasaporte/carnet)
  if (/^[A-Z0-9]{9,20}$/.test(limpio)) {
    return { tipo: 'dni', valor: limpio }; // Lo tratamos como documento
  }
  
  return { tipo: 'desconocido', valor: limpio };
}

// ============================================
// FUNCIONES DE UI
// ============================================
function mostrarAlerta(mensaje, tipo = 'info') {
  // Crear toast
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  
  // Iconos según tipo
  const iconos = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  // Títulos según tipo
  const titulos = {
    success: 'Éxito',
    error: 'Error',
    warning: 'Advertencia',
    info: 'Información'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${iconos[tipo]}</div>
    <div class="toast-content">
      <strong>${titulos[tipo]}</strong>
      ${mensaje}
    </div>
  `;
  
  // Agregar al contenedor
  const container = document.getElementById('toastContainer');
  if (container) {
    container.appendChild(toast);
  }
  
  // Auto-eliminar después de un tiempo
  const duracion = tipo === 'error' ? 5000 : 3000; // Errores duran más
  
  setTimeout(() => {
    toast.classList.add('closing');
    setTimeout(() => {
      toast.remove();
    }, 300); // Tiempo de la animación
  }, duracion);
}

function ocultarAlerta() {
  elements.alerta.classList.add('hidden');
}

function limpiarResultado() {
  elements.resultado.innerHTML = '';
  elements.resultado.classList.add('hidden');
  ocultarAlerta();
  
  // ✅ VOLVER A MODO CENTRADO
  document.body.classList.remove('modo-resultado');
  document.body.classList.add('modo-centrado');

     // ✅ NUEVO: Remover padding del teclado
  document.body.classList.remove('input-activo');
  
  // ✅ NUEVO: Scroll al inicio
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function mostrarSpinner() {
  elements.btnBuscar.disabled = true;
  elements.btnBuscar.innerHTML = '<div class="spinner"></div> Buscando...';
}

function ocultarSpinner() {
  elements.btnBuscar.disabled = false;
  elements.btnBuscar.innerHTML = '🔍 Buscar';
}

// ============================================
// MOSTRAR RESULTADOS
// ============================================
function mostrarPersona(data) {
  console.log('👤 Mostrando persona:', data);
  console.log('🚌 modoRutinasActivo:', modoRutinasActivo);
  
   // ✅ CAMBIAR A MODO RESULTADO
  document.body.classList.remove('modo-centrado');
  document.body.classList.add('modo-resultado');
  
  const tieneIngresoActivo = data.ingreso_activo !== null;
  const esSalida = tieneIngresoActivo;
  const tieneVehiculos = data.vehiculos && data.vehiculos.length > 0;
  const esForaneo = data.origen === 'foraneo';
  const esTemporal = data.tipo_origen === 'temporal' || data.tipo_origen === 'ingreso_temporal';
  const sesion = JSON.parse(localStorage.getItem('sesion'));
  const esOtraUnidad = data.origen === 'personal' && data.unidad !== sesion.usuario.unidad;

    let vehiculoAutorizado = null;
  if (!esSalida && data.visita_autorizada && data.visita_autorizada.vehiculo_autorizado) {
    vehiculoAutorizado = data.visita_autorizada.vehiculo_info;
    console.log('🚗 Vehículo autorizado en visita:', vehiculoAutorizado);
  }
  
  // ✅ SI MODO RUTINAS ESTÁ ACTIVO: Procesar directamente sin preguntar
  if (modoRutinasActivo === true) {
    console.log('🚌 MODO RUTINAS: Registrando automáticamente');
    
    if (esTemporal) {
      registrarIngresoTemporalDirecto(data.id, null, false);
    } else {
      registrarIngreso(data.id, data.origen);
    }
    return;
  }

  console.log('📋 MODO NORMAL: Mostrando opciones');
  
  // ⬇️ FLUJO NORMAL
  
  let infoIngreso = '';
  if (esSalida && data.ingreso_activo) {
    const fechaIngreso = new Date(data.ingreso_activo.fecha_ingreso);
    const horaIngreso = fechaIngreso.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const ingresoConVehiculo = data.ingreso_activo.ingreso_con_vehiculo;
    
    infoIngreso = `
      <div class="alert alert-info" style="margin-top: 16px;">
        <span>ℹ️</span>
        <div>
          <strong>Ingresó a las ${horaIngreso}</strong><br>
          ${ingresoConVehiculo ? '🚗 Ingresó con vehículo' : '🚶 Ingresó sin vehículo'}
        </div>
      </div>
    `;
  }
  
  // ✅ Alerta especial si es temporal
  const alertaTemporal = esTemporal ? `
    <div class="alert alert-warning" style="margin-top: 16px;">
      <span>⚠️</span>
      <div>
        <strong>REGISTRO TEMPORAL</strong><br>
        Esta persona fue registrada temporalmente como no autorizada.
      </div>
    </div>
  ` : '';
  
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon" style="background: ${esTemporal ? '#F59E0B' : (esSalida ? '#EF4444' : '#10B981')};">
          ${esTemporal ? '⚠️' : (esSalida ? '🚪' : '👤')}
        </div>
        <div>
          <h3>${data.nombre}</h3>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <span class="badge badge-primary">${esForaneo ? 'Foráneo' : 'Personal'}</span>
            ${esTemporal ? '<span class="badge" style="background: #F59E0B; color: white;">⚠️ TEMPORAL</span>' : ''}
            <span class="badge" style="background: ${esSalida ? '#EF4444' : '#10B981'}; color: white;">
              ${esSalida ? '📤 SALIDA' : '📥 INGRESO'}
            </span>
          </div>
        </div>
      </div>
      
      <div class="resultado-body">
        <div class="info-row">
          <span class="info-label">NSA:</span>
          <span class="info-value">${data.nsa || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">DNI:</span>
          <span class="info-value">${data.dni || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Unidad:</span>
          <span class="info-value">${data.unidad || 'N/A'}</span>
        </div>
        ${esForaneo ? `
          <div class="info-row">
            <span class="info-label">Origen:</span>
            <span class="info-value">${data.origen_nombre || 'N/A'}</span>
          </div>
        ` : ''}
        
        ${tieneVehiculos && !esSalida ? `
          <div class="info-row">
            <span class="info-label">Vehículos registrados:</span>
            <span class="info-value">${data.vehiculos.length}</span>
          </div>
        ` : ''}
        
        ${alertaTemporal}
        ${infoIngreso}
      </div>

${esSalida ? `
  <!-- Es SALIDA -->
  ${esTemporal ? `
    <!-- SALIDA TEMPORAL - Simple y directo -->
    ${data.placa_vehiculo ? `
      <div class="alert alert-warning" style="margin: 16px 0;">
        <span>🚗</span>
        <div>
          <strong>Vehículo registrado:</strong> ${data.placa_vehiculo}
        </div>
      </div>
    ` : ''}
    
    <div class="resultado-actions">
      <button class="btn" style="background: #EF4444; color: white; font-size: 16px; padding: 14px;" onclick='registrarIngresoTemporalDirecto("${data.id}", null, false)'>
        🚪 Registrar Salida Temporal
      </button>
    </div>
  ` : tieneVehiculos ? `
    <!-- SALIDA NORMAL con vehículos -->
    <div class="alert alert-info" style="margin: 16px 0;">
      <span>🚗</span>
      <div>
        <strong>¿Sale con vehículo?</strong>
      </div>
    </div>
    
    <div class="resultado-actions">
      <button class="btn" style="background: #10B981; color: white;" onclick='solicitarPlacaSalidaWrapper()'>
        ✅ Sí, con vehículo
      </button>
      <button class="btn" style="background: #EF4444; color: white;" onclick="registrarIngreso('${data.id}', '${data.origen}')">
        🚶 No, sin vehículo
      </button>
    </div>
  ` : `
    <!-- SALIDA NORMAL sin vehículos -->
    <div class="resultado-actions">
      <button class="btn" style="background: #EF4444; color: white;" onclick="registrarIngreso('${data.id}', '${data.origen}')">
        🚪 Registrar Salida
      </button>
    </div>
  `}
  ` : `
  <!-- Es INGRESO - SIEMPRE PREGUNTAR (para temporales y normales) -->
  
  ${data.visita_autorizada ? `
    <!-- VISITA AUTORIZADA -->
    <div class="alert alert-success" style="margin: 16px 0;">
      <span>✅</span>
      <div>
        <strong>Visita Autorizada</strong><br>
        Válida del ${formatearFecha(data.visita_autorizada.fec_inicio)} al ${formatearFecha(data.visita_autorizada.fec_fin)}
        ${data.visita_autorizada.motivo ? `<br>Motivo: ${data.visita_autorizada.motivo}` : ''}
      </div>
    </div>
  ` : ''}
  
${vehiculoAutorizado ? `
  <!-- TIENE VEHÍCULO AUTORIZADO EN LA VISITA -->
  <div class="alert alert-success" style="margin: 16px 0;">
    <span>✅</span>
    <div>
      <strong>Vehículo Autorizado en Visita:</strong><br>
      ${vehiculoAutorizado.placa} - ${vehiculoAutorizado.marca || ''} ${vehiculoAutorizado.modelo || ''}
    </div>
  </div>
  
  <div class="alert alert-info" style="margin: 16px 0;">
    <span>🚗</span>
    <div>
      <strong>¿Ingresó con este vehículo?</strong>
    </div>
  </div>
  
  <div class="resultado-actions">
    <button class="btn btn-success" onclick='registrarIngresoConVehiculoAutorizado(${JSON.stringify(data)}, ${JSON.stringify(vehiculoAutorizado)})'>
      ✅ Sí, con ${vehiculoAutorizado.placa}
    </button>
    <button class="btn btn-primary" onclick="registrarIngreso('${data.id}', '${data.origen}')">
      🚶 No, sin vehículo
    </button>
    ${tieneVehiculos ? `
      <button class="btn" style="background: #6B7280; color: white;" onclick='mostrarVehiculosPersona(${JSON.stringify(data)})'>
        🚗 Otro vehículo registrado
      </button>
    ` : ''}
  </div>
` : `
  <!-- NO TIENE VEHÍCULO AUTORIZADO -->
  <div class="alert alert-info" style="margin: 16px 0;">
    <span>🚗</span>
    <div>
      <strong>¿Ingresó con su vehículo?</strong>
    </div>
  </div>
  
  <div class="resultado-actions">
    ${esTemporal ? `
      <!-- TEMPORAL: Ingreso temporal -->
      <button class="btn btn-success" onclick='solicitarPlacaIngresoTemporal(${JSON.stringify(data)})'>
        ✅ Sí, con vehículo
      </button>
      <button class="btn btn-primary" onclick='registrarIngresoTemporalDirecto("${data.id}", null, false)'>
        🚶 No, sin vehículo
      </button>
    ` : (data.origen === 'foraneo' && !data.visita_autorizada) ? `
      <!-- FORÁNEO SIN VISITA AUTORIZADA: Ingreso temporal -->
      <button class="btn btn-success" onclick='solicitarPlacaIngresoTemporal(${JSON.stringify(data)})'>
        ✅ Sí, con vehículo
      </button>
      <button class="btn btn-primary" onclick='registrarIngresoTemporalDirecto("${data.id}", null, false)'>
        🚶 No, sin vehículo
      </button>
   ` : esOtraUnidad ? `
      <!-- PERSONAL DE OTRA UNIDAD: Pedir motivo y responsable -->
      <div class="alert alert-warning" style="margin: 16px 0;">
        <span>⚠️</span>
        <div>
          <strong>Personal de otra unidad</strong><br>
          ${data.unidad} → Debe indicar motivo y responsable
        </div>
      </div>
      
      <div class="resultado-actions">
        ${tieneVehiculos ? `
      <button class="btn btn-primary" onclick='solicitarDatosOtraUnidad(${JSON.stringify(data)})'>
        ⚠️ Continuar
      </button>
      </div>
    ` : tieneVehiculos ? `
      <!-- TIENE VEHÍCULOS REGISTRADOS: Ingreso normal -->
      <button class="btn btn-success" onclick='mostrarVehiculosPersona(${JSON.stringify(data)})'>
        ✅ Sí, con vehículo
      </button>
      <button class="btn btn-primary" onclick="registrarIngreso('${data.id}', '${data.origen}')">
        🚶 No, sin vehículo
      </button>
    ` : `
      <!-- NO TIENE VEHÍCULOS: Ingreso normal pero solicitar placa -->
      <button class="btn btn-success" onclick='solicitarPlacaIngreso(${JSON.stringify(data)})'>
        ✅ Sí, con vehículo
      </button>
      <button class="btn btn-primary" onclick="registrarIngreso('${data.id}', '${data.origen}')">
        🚶 No, sin vehículo
      </button>
    `}
  </div>
`}
`}
    </div>
  `;
  
  elements.resultado.classList.remove('hidden');
  window.personaActual = data;
}
async function registrarIngresoConVehiculoAutorizado(persona, vehiculoInfo) {
  try {
    mostrarAlerta('Verificando vehículo autorizado...', 'info');
    
    // Buscar el vehículo en la tabla vehiculo_seguridad por placa
    const sesion = JSON.parse(localStorage.getItem('sesion'));
    
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        codigo: vehiculoInfo.placa,
        tipo: 'placa',
        unidad: sesion.usuario.unidad || ''
      }),
    });
    
    const resultado = await response.json();
    
    if (!resultado.success) {
      throw new Error(`No se encontró el vehículo ${vehiculoInfo.placa} en el sistema`);
    }
    
    // Usar el ID del vehículo encontrado
    window.vehiculoEnProceso = resultado.data.id;
    
    // Registrar ingreso con ese vehículo
    await registrarIngresoConVehiculo(persona);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}
// ============================================
// SOLICITAR DATOS PARA PERSONAL DE OTRA UNIDAD
// ============================================
function solicitarDatosOtraUnidad(persona) {
  console.log('📋 Solicitando datos adicionales para personal de otra unidad');
  
  // Guardar persona en variable global
  window.personaOtraUnidad = persona;
  
  const tieneVehiculos = persona.vehiculos && persona.vehiculos.length > 0;
  
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon" style="background: #F59E0B;">⚠️</div>
        <div>
          <h3>Personal de Otra Unidad</h3>
          <span class="badge" style="background: #F59E0B; color: white;">OTRA UNIDAD</span>
        </div>
      </div>
      
      <div class="resultado-body">
        <div class="alert alert-warning">
          <span>⚠️</span>
          <div>
            <strong>${persona.nombre}</strong><br>
            Unidad: ${persona.unidad}<br>
            Debe registrar motivo y responsable
          </div>
        </div>
        
        <div class="input-group">
          <label for="inputMotivoOtraUnidad">Motivo de Visita: *</label>
          <input 
            type="text" 
            id="inputMotivoOtraUnidad" 
            placeholder="Ej: REUNIÓN, COORDINACIÓN, ETC"
            autocomplete="off"
            style="text-transform: uppercase;"
            required
          >
        </div>
        
        <div class="input-group">
          <label for="selectResponsableOtraUnidad">Responsable: *</label>
          <select id="selectResponsableOtraUnidad" required style="width: 100%; padding: 10px; border-radius: 6px; border: 2px solid #E5E7EB;">
            <option value="">Seleccione una dependencia</option>
          </select>
        </div>
        
        <div class="alert alert-info" style="margin-top: 16px;">
          <span>🚗</span>
          <div>
            <strong>¿Ingresó con su vehículo?</strong>
          </div>
        </div>
      </div>

      <div class="resultado-actions">
        ${tieneVehiculos ? `
          <button class="btn btn-success" onclick="confirmarDatosOtraUnidadConVehiculo()">
            ✅ Sí, con vehículo
          </button>
        ` : ''}
        <button class="btn btn-primary" onclick="confirmarDatosOtraUnidadSinVehiculo()">
          🚶 No, sin vehículo
        </button>
        <button class="btn" style="background: #6B7280; color: white;" onclick="mostrarPersona(window.personaOtraUnidad)">
          ← Volver
        </button>
      </div>
    </div>
  `;
  
  // Llenar selector de dependencias
  setTimeout(() => {
    llenarSelectDependenciasOtraUnidad();
    document.getElementById('inputMotivoOtraUnidad')?.focus();
  }, 100);
}

function llenarSelectDependenciasOtraUnidad() {
  const select = document.getElementById('selectResponsableOtraUnidad');
  if (!select || !listaDependencias) return;
  
  select.innerHTML = '<option value="">Seleccione una dependencia</option>';
  
  listaDependencias.forEach(dep => {
    const option = document.createElement('option');
    option.value = dep.descripcion;
    option.textContent = dep.descripcion;
    select.appendChild(option);
  });
}

// ============================================
// CONFIRMAR CON VEHÍCULO
// ============================================
function confirmarDatosOtraUnidadConVehiculo() {
  const motivo = document.getElementById('inputMotivoOtraUnidad')?.value.trim().toUpperCase();
  const responsable = document.getElementById('selectResponsableOtraUnidad')?.value;
  
  if (!motivo) {
    mostrarAlerta('El motivo es obligatorio', 'error');
    document.getElementById('inputMotivoOtraUnidad')?.focus();
    return;
  }
  
  if (!responsable) {
    mostrarAlerta('Debe seleccionar un responsable', 'error');
    document.getElementById('selectResponsableOtraUnidad')?.focus();
    return;
  }
  
  // Guardar datos temporales
  window.datosOtraUnidadTemp = { motivo, responsable };
  
  // Mostrar vehículos para que seleccione
  mostrarVehiculosPersona(window.personaOtraUnidad);
}

// ============================================
// CONFIRMAR SIN VEHÍCULO
// ============================================
async function confirmarDatosOtraUnidadSinVehiculo() {
  const motivo = document.getElementById('inputMotivoOtraUnidad')?.value.trim().toUpperCase();
  const responsable = document.getElementById('selectResponsableOtraUnidad')?.value;
  
  if (!motivo) {
    mostrarAlerta('El motivo es obligatorio', 'error');
    document.getElementById('inputMotivoOtraUnidad')?.focus();
    return;
  }
  
  if (!responsable) {
    mostrarAlerta('Debe seleccionar un responsable', 'error');
    document.getElementById('selectResponsableOtraUnidad')?.focus();
    return;
  }
  
  // Guardar datos temporales
  window.datosOtraUnidadTemp = { motivo, responsable };
  
  // Registrar ingreso sin vehículo
  await registrarIngreso(window.personaOtraUnidad.id, window.personaOtraUnidad.origen);
}

function llenarSelectDependenciasOtraUnidad() {
  const select = document.getElementById('selectResponsableOtraUnidad');
  if (!select || !listaDependencias) return;
  
  select.innerHTML = '<option value="">Seleccione una dependencia</option>';
  
  listaDependencias.forEach(dep => {
    const option = document.createElement('option');
    option.value = dep.descripcion;
    option.textContent = dep.descripcion;
    select.appendChild(option);
  });
}
  
function solicitarPlacaSalidaWrapper() {
  if (window.personaActual) {
    solicitarPlacaSalida(window.personaActual);
  }
}
function mostrarVehiculosPersona(persona) {
  const vehiculosHTML = persona.vehiculos.map(v => {
    const docsVencidos = verificarDocumentosVencidos(v);
    const tieneVencidos = docsVencidos.length > 0;
    
    return `
      <div class="vehiculo-item" 
           style="padding: 12px; border: 2px solid ${tieneVencidos ? '#F59E0B' : '#E5E7EB'}; 
                  background: ${tieneVencidos ? '#FEF3C7' : 'white'};
                  border-radius: 8px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s;"
           onclick='seleccionarVehiculo(${JSON.stringify(persona)}, ${JSON.stringify(v)})'
           onmouseover="this.style.borderColor='${tieneVencidos ? '#D97706' : '#4F46E5'}'; this.style.background='${tieneVencidos ? '#FDE68A' : '#F0F9FF'}'"
           onmouseout="this.style.borderColor='${tieneVencidos ? '#F59E0B' : '#E5E7EB'}'; this.style.background='${tieneVencidos ? '#FEF3C7' : 'white'}'">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 16px; color: #111827;">
              ${tieneVencidos ? '⚠️' : '🚗'} ${v.placa}
            </div>
            <div style="font-size: 14px; color: #6B7280;">
              ${v.marca || ''} ${v.modelo || ''} ${v.color ? '- ' + v.color : ''}
            </div>
            ${tieneVencidos ? `
              <div style="font-size: 12px; color: #92400E; margin-top: 4px;">
                ${docsVencidos.join(', ')}
              </div>
            ` : ''}
          </div>
          <div style="font-size: 24px;">→</div>
        </div>
      </div>
    `;
  }).join('');
  
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon">🚗</div>
        <div>
          <h3>Selecciona el vehículo</h3>
          <span class="badge badge-primary">${persona.nombre}</span>
        </div>
      </div>
      
      <div class="resultado-body">
        <div style="margin-bottom: 12px; color: #6B7280; font-size: 14px;">
          Selecciona con qué vehículo ingresó:
        </div>
        ${vehiculosHTML}
        
        <div style="margin-top: 12px; padding: 12px; background: #F0F9FF; border-radius: 8px; font-size: 13px; color: #1E40AF;">
          ℹ️ Los vehículos con documentos vencidos pueden ingresar pero deben regularizarse
        </div>
      </div>

      <div class="resultado-actions">
        <button class="btn" style="background: #6B7280; color: white;" onclick='mostrarPersona(${JSON.stringify(persona)})'>
          ← Volver
        </button>
        <button class="btn" style="background: #6B7280; color: white;" onclick='escanearOtraPlaca(${JSON.stringify(persona)})'>
  🔍 Escanear otra placa
</button>
      </div>
    </div>
  `;
}
function escanearOtraPlaca(persona) {
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon">🚗</div>
        <div>
          <h3>Escanear Otro Vehículo</h3>
          <span class="badge badge-primary">${persona.nombre}</span>
        </div>
      </div>
      
      <div class="resultado-body">
        <div class="alert alert-info">
          <span>ℹ️</span>
          <div>Escanea la placa del vehículo con el que ingresa</div>
        </div>
        
        <div class="input-group">
          <label for="inputOtraPlaca">Placa del vehículo:</label>
          <input 
            type="text" 
            id="inputOtraPlaca" 
            placeholder="Ej: XYZ-789"
            autocomplete="off"
            style="text-align: center; text-transform: uppercase;"
          >
        </div>
      </div>

      <div class="resultado-actions">
        <button class="btn btn-success" onclick="procesarIngresoConOtraPlaca()">
          ✅ Registrar Ingreso
        </button>
        <button class="btn" style="background: #6B7280; color: white;" onclick='mostrarVehiculosPersona(${JSON.stringify(persona)})'>
          ← Volver
        </button>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    document.getElementById('inputOtraPlaca').focus();
    
    document.getElementById('inputOtraPlaca').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        procesarIngresoConOtraPlaca();
      }
    });
  }, 100);
  
  window.personaIngreso = persona;
}
function solicitarPlacaIngreso(persona) {
  console.log('🚗 Solicitando placa para persona sin vehículos registrados');
  
  // Guardar persona en window para uso posterior
  window.personaIngreso = persona;
  
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon" style="background: #10B981;">🚗</div>
        <div>
          <h3>Identificar Vehículo</h3>
          <span class="badge badge-primary">${persona.nombre}</span>
        </div>
      </div>
      
      <div class="resultado-body">
        <div class="alert alert-info">
          <span>ℹ️</span>
          <div>
            <strong>Ingrese la placa del vehículo</strong><br>
            El sistema verificará si está registrado. Si no existe, se creará como temporal.
          </div>
        </div>
        
        <div class="input-group">
          <label for="inputOtraPlaca">Placa del vehículo:</label>
          <input 
            type="text" 
            id="inputOtraPlaca" 
            placeholder="Ej: ABC-123"
            autocomplete="off"
            style="text-align: center; text-transform: uppercase;"
          >
        </div>
      </div>

      <div class="resultado-actions">
        <button class="btn btn-success" onclick="procesarIngresoConOtraPlaca()">
          ✅ Verificar y Continuar
        </button>
        <button class="btn" style="background: #6B7280; color: white;" onclick='mostrarPersona(${JSON.stringify(persona)})'>
          ← Volver
        </button>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    const input = document.getElementById('inputOtraPlaca');
    if (input) {
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          procesarIngresoConOtraPlaca();
        }
      });
    }
  }, 100);
}

async function procesarIngresoConOtraPlaca() {
  try {
    const inputPlaca = document.getElementById('inputOtraPlaca');
    const placa = inputPlaca.value.trim().toUpperCase();
    
    if (!placa) {
      mostrarAlerta('Por favor ingresa la placa', 'error');
      return;
    }
    
    mostrarAlerta('Buscando vehículo...', 'info');
    
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        codigo: placa,
        tipo: 'placa',
        unidad: sesion.usuario.unidad || ''
      }),
    });
const resultado = await response.json();

// Si el vehículo NO existe, crearlo como temporal
if (!resultado.success) {
  mostrarAlerta('⚠️ VEHÍCULO NO REGISTRADO O AUTORIZADO - Registrando como temporal...', 'warning');
  
  const idVehiculoTemporal = await crearVehiculoTemporal(placa, window.personaIngreso);
  window.vehiculoEnProceso = idVehiculoTemporal;
  await registrarIngresoConVehiculo(window.personaIngreso);
  return;
}

if (resultado.data.tipo_resultado !== 'vehiculo') {
  throw new Error('El código no corresponde a un vehículo');
}

// Registrar ingreso con ese vehículo
window.vehiculoEnProceso = resultado.data.id;
await registrarIngresoConVehiculo(window.personaIngreso);    

    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}

function seleccionarVehiculo(persona, vehiculo) {
  const documentosVencidos = verificarDocumentosVencidos(vehiculo);
  const tieneVencidos = documentosVencidos.length > 0;
  
  if (tieneVencidos) {
    // Mostrar confirmación con advertencia
    elements.resultado.innerHTML = `
      <div class="resultado-card">
        <div class="resultado-header">
          <div class="resultado-icon">⚠️</div>
          <div>
            <h3>Confirmar ingreso</h3>
            <span class="badge" style="background: #F59E0B; color: white;">Documentos vencidos</span>
          </div>
        </div>
        
        <div class="resultado-body">
          <div class="alert alert-warning">
            <span style="font-size: 24px;">⚠️</span>
            <div>
              <strong>Vehículo ${vehiculo.placa} tiene documentos vencidos:</strong><br><br>
              ${documentosVencidos.map(doc => `• ${doc}`).join('<br>')}<br><br>
              <strong>¿Deseas registrar el ingreso de todos modos?</strong>
            </div>
          </div>
          
          <div style="padding: 12px; background: #F3F4F6; border-radius: 8px; margin-top: 12px;">
            <div style="font-size: 14px; color: #4B5563;">
              <strong>👤 Conductor:</strong> ${persona.nombre}<br>
              <strong>🚗 Vehículo:</strong> ${vehiculo.placa}
            </div>
          </div>
        </div>

        <div class="resultado-actions">
          <button class="btn btn-success" onclick='confirmarIngresoConVehiculo(${JSON.stringify(persona)}, ${JSON.stringify(vehiculo)})'>
            ✅ Sí, registrar ingreso
          </button>
          <button class="btn" style="background: #6B7280; color: white;" onclick='mostrarVehiculosPersona(${JSON.stringify(persona)})'>
            ← Volver
          </button>
        </div>
      </div>
    `;
  } else {
    // Sin documentos vencidos, registrar directamente
    confirmarIngresoConVehiculo(persona, vehiculo);
  }
}

function confirmarIngresoConVehiculo(persona, vehiculo) {
  registrarIngresoConVehiculoSeleccionado(persona, vehiculo);
}

async function registrarIngresoConVehiculoSeleccionado(persona, vehiculo) {
  try {
    mostrarAlerta('Registrando ingreso con vehículo...', 'info');
    
    const sesion = JSON.parse(localStorage.getItem('sesion'));
    const idUsuario = sesion.usuario.id;
    
// ✅ Verificar si hay datos adicionales de otra unidad
    const datosAdicionales = window.datosOtraUnidadTemp || null;
    
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.REGISTRAR_INGRESO_SALIDA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        id_persona: persona.id,
        tipo_persona: persona.origen,
        id_vehiculo: vehiculo.id,
        ingreso_con_vehiculo: true,
        id_usuario: idUsuario,
        motivo_visita: datosAdicionales?.motivo || null,
        responsable: datosAdicionales?.responsable || null
      }),
    });
    
    // ✅ Limpiar datos temporales después de usar
    window.datosOtraUnidadTemp = null;
    
    const resultado = await response.json();
    
    if (!resultado.success) {
      throw new Error(resultado.error);
    }
    
    const mensaje = resultado.accion === 'ingreso' 
      ? `✅ Ingreso registrado: ${persona.nombre} con vehículo ${vehiculo.placa}`
      : `✅ Salida registrada: ${persona.nombre} con vehículo ${vehiculo.placa}`;
    
    mostrarAlerta(mensaje, 'success');
    
    setTimeout(() => {
      limpiarResultado();
      elements.inputCodigo.value = '';
      elements.inputCodigo.focus();
    }, 2500);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}
function mostrarVehiculo(data) {
    // ✅ CAMBIAR A MODO RESULTADO
  document.body.classList.remove('modo-centrado');
  document.body.classList.add('modo-resultado');
  
  const documentosVencidos = verificarDocumentosVencidos(data);
  const tieneDocumentosVencidos = documentosVencidos.length > 0;
  const tieneIngresoActivo = data.ingreso_activo !== null;
  const esSalida = tieneIngresoActivo;
  
  // Si es salida, obtener info del conductor
  let infoConductor = '';
  if (esSalida && data.ingreso_activo) {
    const fechaIngreso = new Date(data.ingreso_activo.fecha_ingreso);
    const horaIngreso = fechaIngreso.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    
    infoConductor = `
      <div class="alert alert-info" style="margin-top: 16px;">
        <span>ℹ️</span>
        <div>
          <strong>Ingresó a las ${horaIngreso}</strong><br>
          Identificar quién conduce para registrar salida
        </div>
      </div>
    `;
  }
  
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon">${esSalida ? '🚪' : '🚗'}</div>
        <div>
          <h3>${data.placa}</h3>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <span class="badge badge-primary">Vehículo</span>
            <span class="badge" style="background: ${esSalida ? '#EF4444' : '#10B981'}; color: white;">
              ${esSalida ? '📤 SALIDA' : '📥 INGRESO'}
            </span>
          </div>
        </div>
      </div>
      
      <div class="resultado-body">
        <div class="info-row">
          <span class="info-label">Marca:</span>
          <span class="info-value">${data.marca || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Modelo:</span>
          <span class="info-value">${data.modelo || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Color:</span>
          <span class="info-value">${data.color || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Propietario:</span>
          <span class="info-value">${data.propietario_nombre || 'N/A'}</span>
        </div>
        
        ${!esSalida && tieneDocumentosVencidos ? `
          <div class="alert alert-warning" style="margin-top: 16px;">
            <span style="font-size: 24px;">⚠️</span>
            <div>
              <strong>Documentos vencidos:</strong><br>
              ${documentosVencidos.map(doc => `• ${doc}`).join('<br>')}
              <div style="margin-top: 8px; font-size: 13px;">
                ⚠️ Se permite el ingreso pero debe regularizar
              </div>
            </div>
          </div>
        ` : !esSalida ? `
          <div class="alert alert-success" style="margin-top: 16px;">
            <span>✅</span>
            <div>
              <strong>Documentos al día</strong>
            </div>
          </div>
        ` : ''}
        
        ${infoConductor}
      </div>

      <div class="resultado-actions">
        ${esSalida ? `
            <button class="btn" style="background: #EF4444; color: white;" 
              onclick="solicitarConductorSalidaWrapper()">
        👤 ¿Quién conduce?
      </button>
        ` : `
          <button class="btn btn-primary" onclick="solicitarConductorWrapper()">
            👤 ¿Quién conduce?
          </button>
        `}
      </div>
    </div>
`;
    elements.resultado.classList.remove('hidden');
  
  // ✅ AGREGAR ESTAS LÍNEAS:
  window.vehiculoActual = data;
}

// ✅ AGREGAR ESTA FUNCIÓN COMPLETA DESPUÉS DEL CIERRE DE mostrarVehiculo:
function solicitarConductorSalidaWrapper() {
  if (window.vehiculoActual) {
    solicitarConductorSalida(
      window.vehiculoActual.id,
      window.vehiculoActual.ingreso_activo.id_persona,
      window.vehiculoActual.ingreso_activo.tipo_persona
    );
  }
}
function solicitarConductorWrapper() {
  if (window.vehiculoActual) {
    solicitarConductor(window.vehiculoActual.id);
  }
}
async function solicitarConductorSalida(vehiculoId, idPersonaIngreso, tipoPersonaIngreso) {
  console.log('👤 Solicitar conductor para SALIDA del vehículo:', vehiculoId);
  
  // Guardar datos del vehículo y persona que ingresó
  window.vehiculoEnProcesoSalida = {
    vehiculoId,
    idPersonaIngreso,
    tipoPersonaIngreso
  };
  
  // Obtener conductor desde los datos del vehículo que ya tenemos
  const conductorQueIngreso = window.vehiculoActual?.conductor_data || null;
  
  if (conductorQueIngreso) {
    window.conductorPredeterminado = conductorQueIngreso;
  }
  
  // Mostrar pantalla con conductor pre-seleccionado
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon">👤</div>
        <div>
          <h3>Identificar Conductor</h3>
          <span class="badge" style="background: #EF4444; color: white;">SALIDA</span>
        </div>
      </div>
      
      <div class="resultado-body">
        ${conductorQueIngreso ? `
          <div class="alert alert-success" style="margin-bottom: 16px;">
            <span>⭐</span>
            <div>
              <strong>Conductor que ingresó:</strong><br>
              ${conductorQueIngreso.nombre}<br>
              <small>${conductorQueIngreso.nsa ? 'NSA: ' + conductorQueIngreso.nsa : ''} ${conductorQueIngreso.dni ? '| DNI: ' + conductorQueIngreso.dni : ''}</small>
            </div>
          </div>
          
          <div class="resultado-actions" style="margin-bottom: 16px;">
            <button class="btn btn-success" onclick="confirmarConductorPredeterminado()">
              ✅ Salida con ${conductorQueIngreso.nombre.split(' ')[0]}
            </button>
          </div>
          
          <div style="text-align: center; margin: 16px 0; color: #6B7280; font-size: 14px; font-weight: 600;">
            - O identifica otro conductor -
          </div>
        ` : `
          <div class="alert alert-info" style="margin-bottom: 16px;">
            <span>ℹ️</span>
            <div>
              <strong>Identifica quién conduce el vehículo</strong>
            </div>
          </div>
        `}
        
        <div class="input-group">
          <label for="inputConductorSalida">Escanea o ingresa NSA/DNI del conductor:</label>
          <input 
            type="text" 
            id="inputConductorSalida" 
            placeholder="Ej: 97778, 46025765"
            autocomplete="off"
            style="text-align: center; text-transform: uppercase; padding: 12px; font-size: 16px;"
          >
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 12px;">
          <button 
            type="button" 
            class="btn btn-primary" 
            onclick="escanearConductor()"
            style="flex: 1;">
            📷 Escanear DNI/NSA
          </button>
        </div>
      </div>

      <div class="resultado-actions">
        <button class="btn" style="background: #4F46E5; color: white;" onclick="buscarConductorSalida()">
          🔍 Buscar Conductor
        </button>
        <button class="btn" style="background: #6B7280; color: white;" onclick="limpiarResultado()">
          ← Cancelar
        </button>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    const input = document.getElementById('inputConductorSalida');
    if (input) {
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          buscarConductorSalida();
        }
      });
    }
  }, 100);
}
function escanearConductor() {
  // Ocultar el input temporal
  const inputConductor = document.getElementById('inputConductorSalida');
  if (inputConductor) {
    inputConductor.style.display = 'none';
  }
  
  // Crear div para el escáner si no existe
  if (!document.getElementById('readerConductor')) {
    const readerDiv = document.createElement('div');
    readerDiv.id = 'readerConductor';
    readerDiv.style.cssText = 'width: 100%; max-width: 500px; margin: 20px auto;';
    
    const inputGroup = inputConductor.parentElement;
    inputGroup.appendChild(readerDiv);
  }
  
  // Iniciar escáner
  const html5QrCode = new Html5Qrcode("readerConductor");
  
  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 150 } },
    (decodedText) => {
      console.log('✅ Código escaneado:', decodedText);
      
      // Detener escáner
      html5QrCode.stop().then(() => {
        // Limpiar el div del escáner
        const readerDiv = document.getElementById('readerConductor');
        if (readerDiv) {
          readerDiv.remove();
        }
        
        // Mostrar input de nuevo y llenar con el código
        if (inputConductor) {
          inputConductor.style.display = 'block';
          inputConductor.value = decodedText;
          inputConductor.focus();
        }
        
        // Auto-buscar
        buscarConductorSalida();
      });
    },
    (errorMessage) => {
      // Ignorar errores de escaneo continuo
    }
  ).catch((err) => {
    console.error('Error al iniciar cámara:', err);
    mostrarAlerta('No se pudo acceder a la cámara', 'error');
    if (inputConductor) {
      inputConductor.style.display = 'block';
    }
  });
}
function escanearConductorIngreso() {
  const inputConductor = document.getElementById('inputConductor');
  if (inputConductor) {
    inputConductor.style.display = 'none';
  }
  
  if (!document.getElementById('readerConductorIngreso')) {
    const readerDiv = document.createElement('div');
    readerDiv.id = 'readerConductorIngreso';
    readerDiv.style.cssText = 'width: 100%; max-width: 500px; margin: 20px auto;';
    
    const inputGroup = inputConductor.parentElement;
    inputGroup.appendChild(readerDiv);
  }
  
  const html5QrCode = new Html5Qrcode("readerConductorIngreso");
  
  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 150 } },
    (decodedText) => {
      console.log('✅ Código escaneado:', decodedText);
      
      html5QrCode.stop().then(() => {
        const readerDiv = document.getElementById('readerConductorIngreso');
        if (readerDiv) {
          readerDiv.remove();
        }
        
        if (inputConductor) {
          inputConductor.style.display = 'block';
          inputConductor.value = decodedText;
          inputConductor.focus();
        }
        
        buscarConductor();
      });
    },
    (errorMessage) => {
      // Ignorar errores de escaneo continuo
    }
  ).catch((err) => {
    console.error('Error al iniciar cámara:', err);
    mostrarAlerta('No se pudo acceder a la cámara', 'error');
    if (inputConductor) {
      inputConductor.style.display = 'block';
    }
  });
}

async function confirmarConductorPredeterminado() {
  if (window.conductorPredeterminado && window.vehiculoEnProcesoSalida) {
    await registrarSalidaConVehiculo(window.conductorPredeterminado);
  }
}
async function buscarConductorSalida() {
  try {
    const inputConductor = document.getElementById('inputConductorSalida');
    const codigo = inputConductor.value.trim();
    
    if (!codigo) {
      mostrarAlerta('Por favor ingresa el código del conductor', 'error');
      return;
    }
    
    mostrarAlerta('Buscando conductor...', 'info');
    
    const deteccion = detectarTipoCodigo(codigo);
    
    if (deteccion.tipo === 'placa') {
      throw new Error('Debes ingresar un NSA o DNI, no una placa');
    }
    
    if (deteccion.tipo === 'desconocido') {
      throw new Error('Código no reconocido');
    }
    
    // Buscar conductor
   const sesion = JSON.parse(localStorage.getItem('sesion'));
   
   const response = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
       'apikey': CONFIG.SUPABASE_ANON_KEY,
     },
     body: JSON.stringify({
       codigo: deteccion.valor,
       tipo: deteccion.tipo,
       unidad: sesion.usuario.unidad || ''  // ← AGREGAR
     }),
   });
    
    const resultado = await response.json();
    
    if (!resultado.success) {
      throw new Error('Conductor no encontrado');
    }
    
    if (resultado.data.tipo_resultado !== 'persona') {
      throw new Error('El código debe ser de una persona');
    }
    
    const conductor = resultado.data;
    
    // Verificar si el conductor está dentro
    if (!conductor.ingreso_activo) {
      throw new Error(`${conductor.nombre} no tiene ingreso registrado. No puede salir con el vehículo.`);
    }
    
    // Registrar salida
    await registrarSalidaConVehiculo(conductor);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}

async function registrarSalidaConVehiculo(conductor) {
  try {
    const sesion = JSON.parse(localStorage.getItem('sesion'));
    const idUsuario = sesion.usuario.id;
    
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.REGISTRAR_INGRESO_SALIDA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        id_persona: conductor.id,
        tipo_persona: conductor.origen,
        id_vehiculo: window.vehiculoEnProcesoSalida.vehiculoId,
        ingreso_con_vehiculo: true,
        id_usuario: idUsuario
      }),
    });
    
    const resultado = await response.json();
    
    if (!resultado.success) {
      throw new Error(resultado.error);
    }
    
    mostrarAlerta(`✅ Salida registrada: ${conductor.nombre} con vehículo`, 'success');
    
    setTimeout(() => {
      limpiarResultado();
      elements.inputCodigo.value = '';
      elements.inputCodigo.focus();
      window.vehiculoEnProcesoSalida = null;
    }, 2500);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}

async function registrarSalidaVehiculo(vehiculoId, idPersona, tipoPersona) {
  try {
    mostrarAlerta('Registrando salida...', 'info');
    
    const sesion = JSON.parse(localStorage.getItem('sesion'));
    const idUsuario = sesion.usuario.id;
    
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.REGISTRAR_INGRESO_SALIDA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        id_persona: idPersona,
        tipo_persona: tipoPersona,
        id_vehiculo: vehiculoId,
        ingreso_con_vehiculo: true,
        id_usuario: idUsuario
      }),
    });
    
    const resultado = await response.json();
    
    if (!resultado.success) {
      throw new Error(resultado.error);
    }
    
    mostrarAlerta('✅ Salida registrada correctamente', 'success');
    
    setTimeout(() => {
      limpiarResultado();
      elements.inputCodigo.value = '';
      elements.inputCodigo.focus();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}

function verificarDocumentosVencidos(vehiculo) {
  const vencidos = [];
  const hoy = new Date();
  
  if (vehiculo.fec_venc_soat) {
    const vencSOAT = new Date(vehiculo.fec_venc_soat);
    if (vencSOAT < hoy) vencidos.push('SOAT vencido');
  }
  
  if (vehiculo.fec_venc_revtecnica) {
    const vencRev = new Date(vehiculo.fec_venc_revtecnica);
    if (vencRev < hoy) vencidos.push('Revisión técnica vencida');
  }
  
  if (vehiculo.fec_venc_brev) {
    const vencBrev = new Date(vehiculo.fec_venc_brev);
    if (vencBrev < hoy) vencidos.push('Brevete vencido');
  }
  
  return vencidos;
}

// ============================================
// LLAMADAS AL BACKEND
// ============================================
async function buscarCodigo(codigo) {
  try {
    mostrarSpinner();
    ocultarAlerta();
    limpiarResultado();
    
    if (!codigo) {
      codigo = elements.inputCodigo.value.trim();
    }
    
    if (!codigo) {
      throw new Error('Por favor ingresa un código');
    }
    
    const deteccion = detectarTipoCodigo(codigo);
    
    console.log('🔍 Tipo detectado:', deteccion.tipo);
    console.log('📝 Valor:', deteccion.valor);
    
    if (deteccion.tipo === 'desconocido') {
      throw new Error('Código no reconocido. Debe ser NSA (5-6 dígitos), DNI (8 dígitos) o Placa (5-7 caracteres)');
    }
    
    // Llamar a Edge Function
      // Llamar a Edge Function
      const sesion = JSON.parse(localStorage.getItem('sesion'));
      const unidadVigilante = sesion?.usuario?.unidad || '';
      
      const response = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          codigo: deteccion.valor,
          tipo: deteccion.tipo,
          unidad: unidadVigilante  // ← AGREGAR
        }),
      });
    
    const resultado = await response.json();
    console.log('📦 Resultado:', resultado);
    
    // ✅ Si no se encuentra Y es DNI/NSA, mostrar formulario temporal
    if (!resultado.success && (deteccion.tipo === 'dni' || deteccion.tipo === 'nsa')) {
      console.log('⚠️ Persona no encontrada - Mostrando formulario temporal');
      mostrarFormularioIngresoTemporal(deteccion.valor, deteccion.tipo);
      return;
    }
    
    if (!resultado.success) {
      throw new Error(resultado.error || 'No se encontró el código');
    }
    
    // Mostrar resultado según el tipo
    if (resultado.data.tipo_resultado === 'persona') {
      mostrarPersona(resultado.data);
    } else if (resultado.data.tipo_resultado === 'vehiculo') {
      mostrarVehiculo(resultado.data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  } finally {
    ocultarSpinner();
  }
}
function solicitarDatosPersonaTemporal(codigo, tipo, autoRegistrar = false) {
  console.log('📝 Solicitando datos para persona temporal...', { autoRegistrar });
  
  // Guardar en variable global para uso posterior
  window.personaTemporalData = {
    codigo: codigo,
    tipo: tipo,
    autoRegistrar: autoRegistrar
  };
  
  elements.resultado.classList.remove('hidden');
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon" style="background: #F59E0B;">⚠️</div>
        <div>
          <h3>Persona No Autorizada</h3>
          <span class="badge" style="background: #FEF3C7; color: #92400E;">REGISTRO TEMPORAL</span>
        </div>
      </div>
      
      <div class="resultado-body">
        <div class="alert alert-warning">
          <span>⚠️</span>
          <div>
            <strong>${tipo.toUpperCase()}: ${codigo}</strong><br>
            Esta persona no está registrada en el sistema. ${autoRegistrar ? 'En modo rutinas' : 'Puedes'} crear un registro temporal para permitir el acceso.
          </div>
        </div>
        
        <div class="input-group">
          <label for="inputNombreTemporal">Nombre completo de la persona:</label>
          <input 
            type="text" 
            id="inputNombreTemporal" 
            placeholder="Ej: JUAN PÉREZ GARCÍA"
            autocomplete="off"
            style="text-transform: uppercase;"
          >
        </div>
        
        ${!autoRegistrar ? `
          <div class="alert alert-info" style="margin-top: 12px;">
            <span>ℹ️</span>
            <div>
              <small>Después de crear el registro, podrás seleccionar si ingresa con o sin vehículo.</small>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="resultado-actions">
        <button class="btn btn-success" onclick="crearPersonaTemporal()">
          ✅ Crear Registro Temporal
        </button>
        <button class="btn" style="background: #6B7280; color: white;" onclick="limpiarResultado()">
          ← Cancelar
        </button>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    const input = document.getElementById('inputNombreTemporal');
    if (input) {
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          crearPersonaTemporal();
        }
      });
    }
  }, 100);
}

async function crearPersonaTemporal() {
  try {
    const inputNombre = document.getElementById('inputNombreTemporal');
    const nombre = inputNombre?.value.trim().toUpperCase();
    
    if (!nombre) {
      mostrarAlerta('Por favor ingresa el nombre completo', 'error');
      return;
    }
    
    if (nombre.length < 5) {
      mostrarAlerta('El nombre debe tener al menos 5 caracteres', 'error');
      return;
    }
    
    const data = window.personaTemporalData;
    if (!data) {
      mostrarAlerta('Error: No se encontraron los datos de la persona', 'error');
      return;
    }
    
    mostrarAlerta('Creando registro temporal...', 'info');
    
    // Crear persona temporal en la base de datos
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.REGISTRAR_PERSONA_TEMPORAL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        dni: data.codigo,
        nombre: nombre
      }),
    });
    
    const resultado = await response.json();
    
    if (!resultado.success) {
      throw new Error(resultado.error || 'Error al crear registro temporal');
    }
    
    console.log('✅ Persona temporal creada:', resultado.data);
    
    // Crear objeto persona compatible con el sistema
    const personaTemporal = {
      id: resultado.data.id,
      dni: resultado.data.dni,
      nsa: null,
      nombre: resultado.data.nombre,
      origen: 'foraneo',
      origen_nombre: 'TEMPORAL - NO AUTORIZADO',
      tipo_origen: 'temporal',
      activo: true,
      ingreso_activo: null,
      vehiculos: []
    };
    
    mostrarAlerta('✅ Registro temporal creado exitosamente', 'success');
    
    // Decidir flujo según contexto
    // Decidir flujo según contexto
    if (modoRutinasActivo) {
      // MODO RUTINAS: Registrar ingreso automáticamente
      setTimeout(() => {
        registrarIngreso(personaTemporal.id, personaTemporal.origen);
      }, 1000);
       } else {
        // MODO NORMAL: Mostrar opciones de ingreso (con/sin vehículo)
        console.log('🔵 Llamando a mostrarPersona en 1 segundo...', modoRutinasActivo);
        setTimeout(() => {
          console.log('🔵 Ejecutando mostrarPersona ahora, modoRutinasActivo:', modoRutinasActivo);
          mostrarPersona(personaTemporal);
          
          // ✅ IMPORTANTE: Remover el focus de cualquier botón para evitar Enter accidental
          setTimeout(() => {
            document.activeElement?.blur();
          }, 100);
        }, 1000);
      }
    
    // Limpiar datos temporales
    window.personaTemporalData = null;
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}

async function registrarIngreso(personaId, origen) {
  try {
    console.log('📝 Registrando ingreso/salida:', personaId, origen);
    
    // Obtener ID del usuario actual
    const sesion = JSON.parse(localStorage.getItem('sesion'));
    const idUsuario = sesion.usuario.id;
    
    // ✅ Verificar si hay datos adicionales de otra unidad
    const datosAdicionales = window.datosOtraUnidadTemp || null;
    
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.REGISTRAR_INGRESO_SALIDA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        id_persona: personaId,
        tipo_persona: origen,
        id_vehiculo: null,
        ingreso_con_vehiculo: false,
        id_usuario: idUsuario,
        motivo_visita: datosAdicionales?.motivo || null,
        responsable: datosAdicionales?.responsable || null
      }),
    });
    
    // ✅ Limpiar datos temporales
    window.datosOtraUnidadTemp = null;
    
    const resultado = await response.json();
    console.log('📦 Resultado:', resultado);
    
    if (!resultado.success) {
      throw new Error(resultado.error);
    }
    
    // Mostrar mensaje según la acción
    const mensaje = resultado.accion === 'ingreso' 
      ? '✅ Ingreso registrado correctamente'
      : '✅ Salida registrada correctamente';
    
    mostrarAlerta(mensaje, 'success');
    
    // Limpiar después de 2 segundos
    setTimeout(() => {
      limpiarResultado();
      elements.inputCodigo.value = '';
      elements.inputCodigo.focus();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}

function solicitarConductor(vehiculoId) {
  console.log('👤 Solicitar conductor para INGRESO del vehículo:', vehiculoId);
  
  // Guardar el ID del vehículo en una variable global temporal
  window.vehiculoEnProceso = vehiculoId;
  
  // Obtener datos del propietario desde vehiculoActual
  const propietarioData = window.vehiculoActual?.propietario_data;
  
  // Cambiar la UI para solicitar conductor
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon">👤</div>
        <div>
          <h3>Identificar Conductor</h3>
          <span class="badge badge-primary">INGRESO</span>
        </div>
      </div>
      
      <div class="resultado-body">
        ${propietarioData ? `
          <div class="alert alert-success" style="margin-bottom: 16px;">
            <span>⭐</span>
            <div>
              <strong>Propietario del vehículo:</strong><br>
              ${propietarioData.nombre}<br>
              <small>${propietarioData.nsa ? 'NSA: ' + propietarioData.nsa : ''} ${propietarioData.dni ? '| DNI: ' + propietarioData.dni : ''}</small>
            </div>
          </div>
          
          <div class="resultado-actions" style="margin-bottom: 16px;">
            <button class="btn btn-success" onclick="buscarPropietarioConductor()">
              ✅ Ingreso con ${propietarioData.nombre.split(' ')[0]}
            </button>
          </div>
          
          <div style="text-align: center; margin: 16px 0; color: #6B7280; font-size: 14px; font-weight: 600;">
            - O identifica otro conductor -
          </div>
        ` : ''}
        
        <div class="input-group">
          <label for="inputConductor">Escanea o ingresa NSA/DNI del conductor:</label>
          <input 
            type="text" 
            id="inputConductor" 
            placeholder="Ej: 97778, 46025765"
            autocomplete="off"
            style="text-align: center; text-transform: uppercase; padding: 12px; font-size: 16px;"
          >
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 12px;">
          <button 
            type="button" 
            class="btn btn-primary" 
            onclick="escanearConductorIngreso()"
            style="flex: 1;">
            📷 Escanear DNI/NSA
          </button>
        </div>
      </div>

      <div class="resultado-actions">
        <button class="btn" style="background: #4F46E5; color: white;" onclick="buscarConductor()">
          🔍 Buscar Conductor
        </button>
        <button class="btn" style="background: #6B7280; color: white;" onclick="limpiarResultado()">
          ← Cancelar
        </button>
      </div>
    </div>
  `;
  
  // Enfocar el input
  setTimeout(() => {
    const input = document.getElementById('inputConductor');
    if (input) {
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          buscarConductor();
        }
      });
    }
  }, 100);
}
async function buscarPropietarioConductor() {
  // Obtener datos del propietario desde vehiculoActual
  const propietarioData = window.vehiculoActual?.propietario_data;
  
  if (!propietarioData) {
    mostrarAlerta('No se encontró información del propietario. Por favor, escanea manualmente.', 'error');
    return;
  }
  
  try {
    mostrarAlerta('Registrando ingreso con propietario...', 'info');
    
    // Usar los datos del propietario directamente
    const conductorCompleto = {
      tipo_resultado: 'persona',
      origen: propietarioData.origen,
      id: propietarioData.id,
      nsa: propietarioData.nsa,
      dni: propietarioData.dni,
      nombre: propietarioData.nombre,
      unidad: propietarioData.unidad,
      activo: true,
      vehiculos: [],
      ingreso_activo: null
    };
    
    // Registrar ingreso con el propietario como conductor
    await registrarIngresoConVehiculo(conductorCompleto);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}


async function buscarConductor() {
  try {
    const inputConductor = document.getElementById('inputConductor');
    const codigo = inputConductor.value.trim();
    
    if (!codigo) {
      mostrarAlerta('Por favor ingresa el código del conductor', 'error');
      return;
    }
    
    mostrarAlerta('Buscando conductor...', 'info');
    
    const deteccion = detectarTipoCodigo(codigo);
    
    if (deteccion.tipo === 'placa') {
      throw new Error('Debes ingresar un NSA o DNI, no una placa');
    }
    
    if (deteccion.tipo === 'desconocido') {
      throw new Error('Código no reconocido');
    }
    
    // Buscar conductor
      const sesion = JSON.parse(localStorage.getItem('sesion'));
      
      const response = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'apikey': CONFIG.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          codigo: deteccion.valor,
          tipo: deteccion.tipo,
          unidad: sesion.usuario.unidad || ''  // ← AGREGAR
        }),
      });
    
    const resultado = await response.json();
    
    if (!resultado.success) {
      throw new Error('Conductor no encontrado');
    }
    
    if (resultado.data.tipo_resultado !== 'persona') {
      throw new Error('El código debe ser de una persona');
    }
       
    // Registrar ingreso con vehículo
    await registrarIngresoConVehiculo(resultado.data);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}

async function registrarIngresoConVehiculo(conductor) {
  try {
    const sesion = JSON.parse(localStorage.getItem('sesion'));
    const idUsuario = sesion.usuario.id;
    
// ✅ Verificar si hay datos adicionales de otra unidad
    const datosAdicionales = window.datosOtraUnidadTemp || null;
    
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.REGISTRAR_INGRESO_SALIDA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        id_persona: conductor.id,
        tipo_persona: conductor.origen,
        id_vehiculo: window.vehiculoEnProceso,
        ingreso_con_vehiculo: true,
        id_usuario: idUsuario,
        motivo_visita: datosAdicionales?.motivo || null,
        responsable: datosAdicionales?.responsable || null
      }),
    });
    
    // ✅ Limpiar datos temporales después de usar
    window.datosOtraUnidadTemp = null;
    
    const resultado = await response.json();
    
    if (!resultado.success) {
      throw new Error(resultado.error);
    }
    
    const mensaje = resultado.accion === 'ingreso' 
      ? `✅ Ingreso registrado: ${conductor.nombre} con vehículo`
      : `✅ Salida registrada: ${conductor.nombre} con vehículo`;
    
    mostrarAlerta(mensaje, 'success');
    
    // Limpiar después de 2 segundos
    setTimeout(() => {
      limpiarResultado();
      elements.inputCodigo.value = '';
      elements.inputCodigo.focus();
      window.vehiculoEnProceso = null;
    }, 2500);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}
function solicitarPlacaSalida(persona) {
  // Identificar el vehículo con el que ingresó
  const vehiculoIngresoId = persona.ingreso_activo?.id_vehiculo;

  // ✅ VALIDACIÓN MEJORADA
const tieneVehiculos = persona.vehiculos && Array.isArray(persona.vehiculos) && persona.vehiculos.length > 0;
  
// Construir el selector de vehículos
let vehiculosSelectHTML = '<option value="">-- Selecciona un vehículo --</option>';

if (tieneVehiculos) {
  persona.vehiculos.forEach(v => {
      const esVehiculoIngreso = v.id === vehiculoIngresoId;
      vehiculosSelectHTML += `
        <option value="${v.id}" ${esVehiculoIngreso ? 'selected' : ''}>
          ${v.placa} - ${v.marca} ${v.modelo}
          ${esVehiculoIngreso ? ' ⭐ (Ingresó con este)' : ''}
        </option>
      `;
    });
  }
  
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon">🚗</div>
        <div>
          <h3>Seleccionar Vehículo de Salida</h3>
          <span class="badge badge-primary">${persona.nombre}</span>
        </div>
      </div>
      
      <div class="resultado-body">
       ${tieneVehiculos ? `
          <div class="input-group">
            <label for="selectVehiculoSalida">Selecciona el vehículo:</label>
            <select 
              id="selectVehiculoSalida" 
              style="width: 100%; padding: 10px; border-radius: 6px; border: 2px solid #E5E7EB; font-size: 14px;"
            >
              ${vehiculosSelectHTML}
            </select>
          </div>
          
          <div style="text-align: center; margin: 12px 0; color: #6B7280; font-size: 13px;">
            - O -
          </div>
        ` : ''}
        
        <div class="input-group">
          <label for="inputPlacaSalida">O escanea otra placa:</label>
          <input 
            type="text" 
            id="inputPlacaSalida" 
            placeholder="Ej: ABC-123"
            autocomplete="off"
            style="text-align: center; text-transform: uppercase;"
          >
        </div>
      </div>

      <div class="resultado-actions">
        <button class="btn btn-success" onclick="procesarSalidaConVehiculo()">
          🔍 Registrar Salida
        </button>
       <button class="btn" style="background: #6B7280; color: white;" onclick='mostrarPersona(window.personaActual)'>
          ← Volver
        </button>
      </div>
    </div>
  `;
  
setTimeout(() => {
  const selectVehiculo = document.getElementById('selectVehiculoSalida');
  const inputPlaca = document.getElementById('inputPlacaSalida');
  
  if (selectVehiculo) {
    selectVehiculo.focus();
  } else if (inputPlaca) {
    inputPlaca.focus();
  }
  
  // ✅ VALIDAR QUE EXISTE ANTES DE AGREGAR LISTENER
  if (inputPlaca) {
    inputPlaca.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        procesarSalidaConVehiculo();
      }
    });
  }
}, 100);

// Guardar persona en variable global
window.personaSalida = persona;
}
async function procesarSalidaConVehiculo() {
  try {
    // ✅ OBTENER SESIÓN AL INICIO (ANTES de usarla)
    const sesion = JSON.parse(localStorage.getItem('sesion'));
    if (!sesion || !sesion.usuario) {
      throw new Error('Sesión no válida. Por favor inicia sesión nuevamente.');
    }
    
    const selectVehiculo = document.getElementById('selectVehiculoSalida');
    const inputPlaca = document.getElementById('inputPlacaSalida');
    
    let vehiculoId = null;
    let placa = null;
    
    // ✅ PRIORIDAD 1: Si ingresó una placa manualmente (tiene MAYOR prioridad)
    if (inputPlaca && inputPlaca.value.trim()) {
      placa = inputPlaca.value.trim().toUpperCase();
      console.log('📝 Usando placa ingresada manualmente:', placa);
    }
    // PRIORIDAD 2: Si seleccionó un vehículo del dropdown
    else if (selectVehiculo && selectVehiculo.value) {
      vehiculoId = selectVehiculo.value;
      
      // Buscar la placa del vehículo seleccionado
      const vehiculoSeleccionado = window.personaSalida.vehiculos.find(v => v.id === vehiculoId);
      if (vehiculoSeleccionado) {
        placa = vehiculoSeleccionado.placa;
        console.log('📝 Usando vehículo del dropdown:', placa);
      }
    }
    
    // Validar que se haya seleccionado o ingresado algo
    if (!vehiculoId && !placa) {
      mostrarAlerta('Por favor selecciona un vehículo o ingresa una placa', 'error');
      return;
    }
    
    mostrarAlerta('Verificando vehículo...', 'info');
    
    // ✅ BUSCAR Y VALIDAR EL VEHÍCULO (ya sea del dropdown o ingresado manualmente)
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        codigo: placa,
        tipo: 'placa',
        unidad: sesion.usuario.unidad || ''
      }),
    });
    
    const resultado = await response.json();
    
    if (!resultado.success) {
      throw new Error(`Vehículo con placa ${placa} no encontrado en el sistema`);
    }
    
    if (resultado.data.tipo_resultado !== 'vehiculo') {
      throw new Error('El código ingresado no corresponde a un vehículo');
    }
    
    // ⚠️ VALIDAR QUE EL VEHÍCULO ESTÉ DENTRO
    if (!resultado.data.ingreso_activo) {
      throw new Error(`El vehículo ${placa} no está dentro de las instalaciones. No puede salir con un vehículo que no ha ingresado.`);
    }
    
    // Usar el ID del vehículo encontrado
    vehiculoId = resultado.data.id;
    
    console.log('✅ Vehículo validado:', placa, 'ID:', vehiculoId);
    
    // Registrar salida con vehículo
    mostrarAlerta('Procesando salida...', 'info');
    
    const idUsuario = sesion.usuario.id;
    
    const responseSalida = await fetch(CONFIG.EDGE_FUNCTIONS.REGISTRAR_INGRESO_SALIDA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        id_persona: window.personaSalida.id,
        tipo_persona: window.personaSalida.origen,
        id_vehiculo: vehiculoId,
        ingreso_con_vehiculo: true,
        id_usuario: idUsuario
      }),
    });
    
    const resultadoSalida = await responseSalida.json();
    
    if (!resultadoSalida.success) {
      throw new Error(resultadoSalida.error);
    }
    
    mostrarAlerta(`✅ Salida registrada: ${window.personaSalida.nombre} con vehículo ${placa}`, 'success');
    
    setTimeout(() => {
      limpiarResultado();
      elements.inputCodigo.value = '';
      elements.inputCodigo.focus();
      window.personaSalida = null;
    }, 2500);
    
  } catch (error) {
    console.error('Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}
// ============================================
// FUNCIÓN AUXILIAR PARA FORMATEAR FECHAS
// ============================================
function formatearFecha(fecha) {
  if (!fecha) return 'N/A';
  
  // ✅ Split manual - sin conversiones de zona horaria
  const [año, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${año}`;
}
// ============================================
// VERIFICAR AUTENTICACIÓN
// ============================================
function verificarAuth() {
  const sesion = localStorage.getItem('sesion');
  if (!sesion) {
    window.location.href = 'index.html';
  }
}
// ============================================
// CARGAR PAÍSES
// ============================================
async function cargarPaises() {
  try {
    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/pais?activo=eq.true&order=nombre.asc`, {
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      }
    });
    
    if (!response.ok) throw new Error('Error al cargar países');
    
    listaPaises = await response.json();
    console.log('✅ Países cargados:', listaPaises.length, 'registros');
    
  } catch (error) {
    console.error('Error al cargar países:', error);
    mostrarAlerta('Error al cargar lista de países', 'error');
  }
}

// ============================================
// CARGAR DEPENDENCIAS
// ============================================
async function cargarDependencias() {
  try {
    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/dependencias?activo=eq.true&order=descripcion.asc`, {
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      }
    });
    
    if (!response.ok) throw new Error('Error al cargar dependencias');
    
    listaDependencias = await response.json();
    console.log('✅ Dependencias cargadas:', listaDependencias.length, 'registros');
    
  } catch (error) {
    console.error('Error al cargar dependencias:', error);
    mostrarAlerta('Error al cargar lista de dependencias', 'error');
  }
}
async function crearVehiculoTemporal(placa, persona) {
  const sesion = JSON.parse(localStorage.getItem('sesion'));
  
  const response = await fetch(CONFIG.EDGE_FUNCTIONS.REGISTRAR_VEHICULO_TEMPORAL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      'apikey': CONFIG.SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      placa: placa,
      id_propietario: persona.id,
      tipo_propietario: persona.origen === 'foraneo' ? 'personal_foraneo' : 'personal'
    })
  });
  
  const resultado = await response.json();
  
  if (!resultado.success) {
    throw new Error(resultado.error || 'Error al registrar vehículo temporal');
  }
  
  console.log('✅ Vehículo temporal creado:', resultado.data);
  return resultado.data.id;
}

// ============================================
// ESCANEO DE CÓDIGOS DE BARRAS (DNI/NSA)
// ============================================
function iniciarEscanerCodigo() {
  elements.inputCodigo.style.display = 'none';
  
  // Crear contenedor del escáner si no existe
  if (!document.getElementById('reader')) {
    const readerDiv = document.createElement('div');
    readerDiv.id = 'reader';
    readerDiv.style.cssText = 'width: 100%; max-width: 500px; margin: 20px auto; position: relative;';
    elements.inputCodigo.parentElement.insertBefore(readerDiv, elements.inputCodigo.nextSibling);
  }
  
  const readerDiv = document.getElementById('reader');
  readerDiv.style.display = 'block';
  
  // ✅ AGREGAR BOTÓN DE CERRAR ANTES DE INICIAR LA CÁMARA
  readerDiv.innerHTML = `
    <button 
      onclick="detenerEscanerCodigo()" 
      style="
        width: 100%;
        padding: 12px;
        background: #EF4444;
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 12px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        z-index: 10000;
        position: relative;
      ">
      ✕ CERRAR CÁMARA
    </button>
    <div id="reader-camera"></div>
  `;
  
  html5QrCodeScanner = new Html5Qrcode("reader-camera");
  
  const config = {
    fps: 5,
    qrbox: { width: 280, height: 100 },
    disableFlip: false,
    rememberLastUsedCamera: true,
    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
  };
  
  html5QrCodeScanner.start(
    { facingMode: "environment" },
    config,
    (decodedText) => {
      console.log('📷 Código escaneado:', decodedText);
      elements.inputCodigo.value = decodedText;
      detenerEscanerCodigo();
      buscarCodigo();
    }
  ).then(() => {
    setTimeout(() => {
      const videoElement = document.querySelector('#reader-camera video');
      if (videoElement && videoElement.srcObject) {
        streamActual = videoElement.srcObject;
        verificarDisponibilidadFlash();
      }
    }, 500);
  }).catch((err) => {
    console.error('❌ Error al iniciar escáner:', err);
    mostrarAlerta('No se pudo acceder a la cámara', 'error');
    detenerEscanerCodigo();
  });
}

function detenerEscanerCodigo() {
  if (html5QrCodeScanner) {
    html5QrCodeScanner.stop().then(() => {
      const reader = document.getElementById('reader');
      if (reader) {
        reader.style.display = 'none';
        reader.innerHTML = ''; // Limpiar todo el contenido
      }
      elements.inputCodigo.style.display = 'block';
      html5QrCodeScanner = null;
      limpiarEscaner();
    }).catch(() => {
      const reader = document.getElementById('reader');
      if (reader) {
        reader.style.display = 'none';
        reader.innerHTML = ''; // Limpiar todo el contenido
      }
      elements.inputCodigo.style.display = 'block';
      html5QrCodeScanner = null;
      limpiarEscaner();
    });
  } else {
    // Si no hay escáner activo, solo ocultar
    const reader = document.getElementById('reader');
    if (reader) {
      reader.style.display = 'none';
      reader.innerHTML = '';
    }
    elements.inputCodigo.style.display = 'block';
  }
}
// ============================================
// FUNCIONES DE FLASH
// ============================================
async function verificarDisponibilidadFlash() {
  try {
    if (!streamActual) return;
    
    const track = streamActual.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    
    if (capabilities.torch) {
      console.log('✅ Flash disponible en este dispositivo');
      mostrarBotonFlash(track);
    } else {
      console.log('⚠️ Flash no disponible en este dispositivo');
    }
  } catch (error) {
    console.error('Error al verificar flash:', error);
  }
}

function mostrarBotonFlash(track) {
  // Verificar si ya existe el botón
  if (document.getElementById('btn-flash')) return;
  
  const contenedorEscaner = document.getElementById('reader');
  if (!contenedorEscaner) return;
  
  // Crear botón de flash
  const btnFlash = document.createElement('button');
  btnFlash.id = 'btn-flash';
  btnFlash.className = 'btn-flash';
  btnFlash.innerHTML = flashActivado ? '🔦 Flash ON' : '🔦 Flash OFF';
  btnFlash.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFlash(track, btnFlash);
  };
  
  contenedorEscaner.appendChild(btnFlash);
}

async function toggleFlash(track, boton) {
  try {
    flashActivado = !flashActivado;
    
    await track.applyConstraints({
      advanced: [{ torch: flashActivado }]
    });
    
    boton.innerHTML = flashActivado ? '🔦 Flash ON' : '🔦 Flash OFF';
    if (flashActivado) {
      boton.classList.add('active');
    } else {
      boton.classList.remove('active');
    }
    
    console.log(`🔦 Flash ${flashActivado ? 'activado' : 'desactivado'}`);
    
    mostrarAlerta(
      flashActivado ? '🔦 Flash activado' : '💡 Flash desactivado',
      'info'
    );
  } catch (error) {
    console.error('Error al cambiar flash:', error);
    mostrarAlerta('No se pudo cambiar el flash', 'error');
  }
}

function limpiarEscaner() {
  flashActivado = false;
  streamActual = null;
  
  // Eliminar botón de flash si existe
  const btnFlash = document.getElementById('btn-flash');
  if (btnFlash) {
    btnFlash.remove();
  }
}
// ============================================
// ESCANEO OCR PARA PLACAS
// ============================================
function iniciarEscanerPlaca(callback) {
  const container = document.createElement('div');
  container.id = 'ocr-container';
  container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center;';
  
  container.innerHTML = `
    <div style="color: white; text-align: center; padding: 20px;">
      <h3>📷 Escanear Placa de Vehículo</h3>
      <p>Toma una foto clara de la placa</p>
    </div>
    
    <input type="file" id="placaInput" accept="image/*" capture="environment" style="display: none;">
    
    <button onclick="document.getElementById('placaInput').click()" class="btn btn-success" style="margin: 10px;">
      📸 Tomar Foto
    </button>
    
    <button onclick="cerrarEscanerPlaca()" class="btn" style="background: #EF4444; color: white;">
      ✕ Cancelar
    </button>
    
    <div id="ocr-preview" style="margin-top: 20px; max-width: 90%; max-height: 300px; overflow: hidden;"></div>
    <div id="ocr-status" style="color: white; margin-top: 10px;"></div>
  `;
  
  document.body.appendChild(container);
  
  document.getElementById('placaInput').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Mostrar preview
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.maxWidth = '100%';
    img.style.maxHeight = '300px';
    document.getElementById('ocr-preview').innerHTML = '';
    document.getElementById('ocr-preview').appendChild(img);
    
    // Procesar OCR
    document.getElementById('ocr-status').textContent = '⏳ Procesando imagen...';
    
    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            document.getElementById('ocr-status').textContent = `⏳ Procesando: ${Math.round(m.progress * 100)}%`;
          }
        }
      });
      
      // Extraer texto que parece placa (letras y números)
      const texto = result.data.text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      console.log('📝 Texto detectado:', texto);
      
      mostrarConfirmacionPlaca(texto, callback);
      
    } catch (error) {
      console.error('❌ Error OCR:', error);
      mostrarAlerta('Error al procesar la imagen', 'error');
      cerrarEscanerPlaca();
    }
  };
  
  window.cerrarEscanerPlaca = function() {
    const cont = document.getElementById('ocr-container');
    if (cont) cont.remove();
  };
}

function mostrarConfirmacionPlaca(textoDetectado, callback) {
  const container = document.getElementById('ocr-container');
  container.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 12px; max-width: 400px; width: 90%;">
      <h3 style="margin-bottom: 20px;">✅ Placa Detectada</h3>
      
      <div style="margin: 20px 0;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold;">Confirma o corrige la placa:</label>
        <input 
          type="text" 
          id="placaConfirmada" 
          value="${textoDetectado}"
          style="width: 100%; padding: 12px; font-size: 18px; text-align: center; text-transform: uppercase; border: 2px solid #3B82F6; border-radius: 8px;"
          autocomplete="off"
        >
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button onclick="confirmarPlaca()" class="btn btn-success" style="flex: 1;">
          ✅ Confirmar
        </button>
        <button onclick="cerrarEscanerPlaca()" class="btn" style="flex: 1; background: #6B7280; color: white;">
          ✕ Cancelar
        </button>
      </div>
    </div>
  `;
  
  window.confirmarPlaca = function() {
    const placa = document.getElementById('placaConfirmada').value.trim().toUpperCase();
    if (placa) {
      cerrarEscanerPlaca();
      callback(placa);
    } else {
      mostrarAlerta('Por favor ingresa una placa', 'error');
    }
  };
  
  setTimeout(() => {
    document.getElementById('placaConfirmada').focus();
    document.getElementById('placaConfirmada').select();
  }, 100);
}
function toggleModoRutinas() {
  modoRutinasActivo = !modoRutinasActivo;
  
  const btnModoRutinas = document.getElementById('btnModoRutinas');
  
  if (modoRutinasActivo) {
    // Activar modo rutinas
    btnModoRutinas.style.background = '#10B981';
    btnModoRutinas.style.color = 'white';
    btnModoRutinas.innerHTML = '✅ Modo Rutinas ACTIVO';
    mostrarAlerta('🚌 Modo Rutinas activado: Los ingresos/salidas se procesarán automáticamente SIN vehículo', 'success');
    console.log('✅ Modo Rutinas ACTIVADO');
  } else {
    // Desactivar modo rutinas
    btnModoRutinas.style.background = '';
    btnModoRutinas.style.color = '';
    btnModoRutinas.className = 'btn btn-secondary';
    btnModoRutinas.innerHTML = '🚌 Modo Rutinas';
    mostrarAlerta('Modo Rutinas desactivado', 'info');
    console.log('❌ Modo Rutinas DESACTIVADO');
  }
  
  // Limpiar y enfocar input
  limpiarResultado();
}
// Función para registrar ingreso temporal directo
async function registrarIngresoTemporalDirecto(idPersona, idVehiculo, conVehiculo) {
  try {
    if (!window.personaActual) {
      throw new Error('No se encontró información de la persona');
    }
    
    const persona = window.personaActual;
    
    mostrarAlerta('Registrando...', 'info');
    
    // Obtener sesión y UUID del usuario
    const sesion = JSON.parse(localStorage.getItem('sesion'));
    const nsa = sesion.usuario.nsa;
    
    if (!nsa) {
      throw new Error('No se pudo obtener el NSA del usuario');
    }
    
   const responseBuscar = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'apikey': CONFIG.SUPABASE_ANON_KEY,
     },
     body: JSON.stringify({
       codigo: nsa,
       tipo: 'nsa',
       unidad: sesion.usuario.unidad || ''  // ← AGREGAR ESTA LÍNEA
     }),
   });
    
    const resultadoBuscar = await responseBuscar.json();
    if (!resultadoBuscar.success) {
      throw new Error('No se pudo obtener datos del usuario');
    }
    
    const idUsuario = resultadoBuscar.data.id;
    
    // Registrar ingreso/salida temporal
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.REGISTRAR_INGRESO_TEMPORAL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        dni: persona.dni,
        nombre: persona.nombre,
        empresa_procedencia: persona.empresa_procedencia || null,
        placa_vehiculo: persona.placa_vehiculo || null,
        motivo_visita: persona.motivo_visita || null,
        autorizado_por: persona.autorizado_por || 'N/A',
        id_usuario: idUsuario
      }),
    });
    
    const resultado = await response.json();
    
    if (!resultado.success) {
      throw new Error(resultado.error || 'Error al registrar');
    }
    
    const mensaje = resultado.accion === 'ingreso' 
      ? '⚠️ Ingreso temporal registrado correctamente'
      : '⚠️ Salida temporal registrada correctamente';
    
    mostrarAlerta(mensaje, 'warning');
    
    setTimeout(() => {
      limpiarResultado();
      elements.inputCodigo.value = '';
      elements.inputCodigo.focus();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}
// Función para solicitar placa en ingreso temporal
function solicitarPlacaIngresoTemporal(persona) {
  console.log('🚗 Solicitando placa para ingreso temporal');
  window.personaTemporal = persona;
  
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon" style="background: #F59E0B;">🚗</div>
        <div>
          <h3>Identificar Vehículo</h3>
          <span class="badge" style="background: #F59E0B; color: white;">TEMPORAL</span>
        </div>
      </div>
      
      <div class="resultado-body">
        <div class="alert alert-warning">
          <span>⚠️</span>
          <div>
            <strong>${persona.nombre}</strong><br>
            Ingreso temporal con vehículo
          </div>
        </div>
        
        <div class="input-group">
          <label for="inputPlacaTemporal">Placa del vehículo:</label>
          <input 
            type="text" 
            id="inputPlacaTemporal" 
            placeholder="Ej: ABC-123"
            autocomplete="off"
            style="text-transform: uppercase;"
          >
        </div>
      </div>

      <div class="resultado-actions">
        <button class="btn btn-success" onclick="procesarPlacaIngresoTemporal()">
          ✅ Continuar
        </button>
        <button class="btn" style="background: #6B7280; color: white;" onclick="mostrarPersona(window.personaTemporal)">
          ← Volver
        </button>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    const input = document.getElementById('inputPlacaTemporal');
    if (input) {
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          procesarPlacaIngresoTemporal();
        }
      });
    }
  }, 100);
}

async function procesarPlacaIngresoTemporal() {
  const input = document.getElementById('inputPlacaTemporal');
  const placa = input?.value.trim().toUpperCase();
  
  if (!placa) {
    mostrarAlerta('Por favor ingresa una placa', 'error');
    return;
  }
  
  try {
    mostrarAlerta('Verificando vehículo...', 'info');
    
    // Buscar vehículo
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        codigo: placa,
        tipo: 'placa',
        unidad: sesion.usuario.unidad || ''
      }),
    });
    
    const resultado = await response.json();
    
    let idVehiculo;
    
    if (!resultado.success) {
      // Vehículo no existe, crear temporal
      mostrarAlerta('Vehículo no encontrado, registrando como temporal...', 'info');
      idVehiculo = await crearVehiculoTemporal(placa, window.personaTemporal);
    } else {
      idVehiculo = resultado.data.id;
    }
    
    // Registrar ingreso temporal con vehículo
    await registrarIngresoTemporalDirecto(window.personaTemporal.id, idVehiculo, true);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}

// Función para solicitar placa en salida temporal
function solicitarPlacaSalidaTemporal() {
  console.log('🚗 Solicitando placa para salida temporal');
  
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon" style="background: #EF4444;">🚗</div>
        <div>
          <h3>Salida con Vehículo</h3>
          <span class="badge" style="background: #F59E0B; color: white;">TEMPORAL</span>
        </div>
      </div>
      
      <div class="resultado-body">
        <div class="input-group">
          <label for="inputPlacaSalidaTemporal">Placa del vehículo:</label>
          <input 
            type="text" 
            id="inputPlacaSalidaTemporal" 
            placeholder="Ej: ABC-123"
            autocomplete="off"
            style="text-transform: uppercase;"
          >
        </div>
      </div>

      <div class="resultado-actions">
        <button class="btn btn-success" onclick="procesarPlacaSalidaTemporal()">
          ✅ Registrar Salida
        </button>
        <button class="btn" style="background: #6B7280; color: white;" onclick="mostrarPersona(window.personaActual)">
          ← Volver
        </button>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    const input = document.getElementById('inputPlacaSalidaTemporal');
    if (input) {
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          procesarPlacaSalidaTemporal();
        }
      });
    }
  }, 100);
}

async function procesarPlacaSalidaTemporal() {
  const input = document.getElementById('inputPlacaSalidaTemporal');
  const placa = input?.value.trim().toUpperCase();
  
  if (!placa) {
    mostrarAlerta('Por favor ingresa una placa', 'error');
    return;
  }
  
  try {
    mostrarAlerta('Verificando vehículo...', 'info');
    
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        codigo: placa,
        tipo: 'placa',
        unidad: sesion.usuario.unidad || ''
      }),
    });
    
    const resultado = await response.json();
    
    if (!resultado.success) {
      throw new Error('Vehículo no encontrado');
    }
    
    await registrarIngresoTemporalDirecto(window.personaActual.id, resultado.data.id, true);
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}
function mostrarFormularioIngresoTemporal(codigo, tipo) {
  console.log('📝 Mostrando formulario de ingreso temporal');

   // ✅ CAMBIAR A MODO RESULTADO
  document.body.classList.remove('modo-centrado');
  document.body.classList.add('modo-resultado');
  
  // Guardar código para uso posterior
  window.codigoTemporal = codigo;
  
  elements.resultado.classList.remove('hidden');
elements.resultado.innerHTML = `
  <div class="resultado-card">
    <div class="resultado-header">
      <div class="resultado-icon" style="background: #F59E0B;">⚠️</div>
      <div>
        <h3>Persona No Autorizada</h3>
        <span class="badge" style="background: #FEF3C7; color: #92400E;">INGRESO TEMPORAL</span>
      </div>
    </div>
    
    <div class="resultado-body">
      <div class="alert alert-warning">
        <span>⚠️</span>
        <div>
          <strong>N° Documento: ${codigo}</strong><br>
          Esta persona no está registrada. Complete el formulario para autorizar el ingreso temporal.
        </div>
      </div>
      
      <div class="input-group">
        <label for="inputNombreTemporal">Apellidos y Nombres: *</label>
        <input 
          type="text" 
          id="inputNombreTemporal" 
          placeholder="Ej: PÉREZ GARCÍA JUAN"
          autocomplete="off"
          style="text-transform: uppercase;"
          required
        >
      </div>
      
      <div class="input-group">
        <label for="inputGradoTemporal">Grado (Opcional):</label>
        <input 
          type="text" 
          id="inputGradoTemporal" 
          placeholder="Ej: CAPITÁN, ING., DR."
          autocomplete="off"
          style="text-transform: uppercase;"
        >
      </div>
      
      <div class="input-group">
        <label for="inputEmpresaTemporal">Empresa / Entidad / Organización (Opcional):</label>
        <input 
          type="text" 
          id="inputEmpresaTemporal" 
          placeholder="Ej: CONTRATISTA XYZ"
          autocomplete="off"
          style="text-transform: uppercase;"
        >
      </div>
      
      <div class="input-group">
        <label for="selectPaisTemporal">Nacionalidad: *</label>
        <select id="selectPaisTemporal" required style="width: 100%; padding: 10px; border-radius: 6px; border: 2px solid #E5E7EB;">
          <option value="">Seleccione un país</option>
        </select>
      </div>
      
      <div class="input-group">
        <label for="inputMotivoTemporal">Motivo de Visita: *</label>
        <input 
          type="text" 
          id="inputMotivoTemporal" 
          placeholder="Ej: REUNIÓN, TRABAJO, ETC"
          autocomplete="off"
          style="text-transform: uppercase;"
          required
        >
      </div>
      
      <div class="input-group">
        <label for="selectResponsableTemporal">Responsable: *</label>
        <select id="selectResponsableTemporal" required style="width: 100%; padding: 10px; border-radius: 6px; border: 2px solid #E5E7EB;">
          <option value="">Seleccione una dependencia</option>
        </select>
      </div>
      
      <div class="input-group">
        <label for="inputPlacaTemporal">Placa del Vehículo (Opcional):</label>
        <input 
          type="text" 
          id="inputPlacaTemporal" 
          placeholder="Ej: ABC-123"
          autocomplete="off"
          style="text-transform: uppercase;"
        >
      </div>
      
      <div class="alert alert-info" style="margin-top: 12px;">
        <span>ℹ️</span>
        <div>
          <small>* Campos obligatorios</small>
        </div>
      </div>
    </div>

    <div class="resultado-actions">
      <button class="btn btn-success" onclick="registrarIngresoTemporal()">
        ✅ Registrar Ingreso Temporal
      </button>
      <button class="btn" style="background: #6B7280; color: white;" onclick="limpiarResultado()">
        ← Cancelar
      </button>
    </div>
  </div>
`;

// Llenar los selects
setTimeout(() => {
  llenarSelectPaises();
  llenarSelectDependencias();
  document.getElementById('inputNombreTemporal')?.focus();
}, 100);}

function llenarSelectPaises() {
  const select = document.getElementById('selectPaisTemporal');
  if (!select || !listaPaises) return;
  
  select.innerHTML = '<option value="">Seleccione un país</option>';
  
  // ✅ Variable para guardar el option de Perú
  let optionPeru = null;
  
  listaPaises.forEach(pais => {
    const option = document.createElement('option');
    option.value = pais.nombre;
    option.textContent = pais.nombre;
    
    // ✅ Si es Perú, guardarlo para ponerlo al inicio
    if (pais.nombre.toUpperCase() === 'PERÚ' || pais.nombre.toUpperCase() === 'PERU') {
      optionPeru = option;
    } else {
      select.appendChild(option);
    }
  });
  
  // ✅ Si encontramos Perú, insertarlo después del "Seleccione..."
  if (optionPeru) {
    select.insertBefore(optionPeru, select.options[1]);
    // ✅ Seleccionarlo por defecto
    optionPeru.selected = true;
  }
}

function llenarSelectDependencias() {
  const select = document.getElementById('selectResponsableTemporal');
  if (!select || !listaDependencias) return;
  
  select.innerHTML = '<option value="">Seleccione una dependencia</option>';
  
  listaDependencias.forEach(dep => {
    const option = document.createElement('option');
    option.value = dep.descripcion;
    option.textContent = dep.descripcion;
    select.appendChild(option);
  });
}
async function registrarIngresoTemporal() {
  try {
    const nombre = document.getElementById('inputNombreTemporal')?.value.trim().toUpperCase();
    const grado = document.getElementById('inputGradoTemporal')?.value.trim().toUpperCase();
    const empresa = document.getElementById('inputEmpresaTemporal')?.value.trim().toUpperCase();
    const pais = document.getElementById('selectPaisTemporal')?.value;
    const motivo = document.getElementById('inputMotivoTemporal')?.value.trim().toUpperCase();
    const responsable = document.getElementById('selectResponsableTemporal')?.value;
    const placa = document.getElementById('inputPlacaTemporal')?.value.trim().toUpperCase();
    
    // Validaciones
    if (!nombre) {
      mostrarAlerta('El nombre es obligatorio', 'error');
      document.getElementById('inputNombreTemporal')?.focus();
      return;
    }
    
    if (nombre.length < 5) {
      mostrarAlerta('El nombre debe tener al menos 5 caracteres', 'error');
      return;
    }
    
    if (!pais) {
      mostrarAlerta('Debe seleccionar una nacionalidad', 'error');
      document.getElementById('selectPaisTemporal')?.focus();
      return;
    }
    
    if (!motivo) {
      mostrarAlerta('El motivo de visita es obligatorio', 'error');
      document.getElementById('inputMotivoTemporal')?.focus();
      return;
    }
    
    if (!responsable) {
      mostrarAlerta('Debe seleccionar un responsable', 'error');
      document.getElementById('selectResponsableTemporal')?.focus();
      return;
    }
    
    mostrarAlerta('Registrando ingreso temporal...', 'info');
    
    // Obtener sesión
    const sesion = JSON.parse(localStorage.getItem('sesion'));
    console.log('📝 Sesión completa:', sesion);

    if (!sesion || !sesion.usuario) {
      throw new Error('No se pudo obtener datos del usuario. Por favor inicia sesión nuevamente.');
    }

    const nsa = sesion.usuario.nsa;
    const unidadVigilante = sesion.usuario.unidad;
    console.log('👤 NSA del usuario:', nsa);
    console.log('🏢 Unidad:', unidadVigilante);

    if (!nsa) {
      throw new Error('El usuario no tiene NSA registrado');
    }

    // Buscar el UUID del usuario
    console.log('🔍 Buscando UUID del usuario en tabla personal...');
    
    const responseBuscar = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        codigo: nsa,
        tipo: 'nsa',
        unidad: unidadVigilante || ''
      }),
    });

    const resultadoBuscar = await responseBuscar.json();
    console.log('📦 Resultado búsqueda usuario:', resultadoBuscar);

    if (!resultadoBuscar.success) {
      throw new Error('No se encontró al usuario en la tabla personal. Contacte al administrador.');
    }

    const idUsuario = resultadoBuscar.data.id;
    console.log('✅ UUID del usuario encontrado:', idUsuario);
    
    // Registrar ingreso temporal
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.REGISTRAR_INGRESO_TEMPORAL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        dni: window.codigoTemporal,
        nombre: nombre,
        grado: grado || null,
        empresa_procedencia: empresa || null,
        pais: pais,
        placa_vehiculo: placa || null,
        motivo_visita: motivo,
        autorizado_por: responsable,
        id_usuario: idUsuario,
        unidad: unidadVigilante
      }),
    });
    
    const resultado = await response.json();
    console.log('📦 Resultado registro temporal:', resultado);
    
    if (!resultado.success) {
      throw new Error(resultado.error || 'Error al registrar ingreso temporal');
    }
    
    mostrarAlerta('✅ Ingreso temporal registrado exitosamente', 'success');
    
    setTimeout(() => {
      limpiarResultado();
      elements.inputCodigo.value = '';
      elements.inputCodigo.focus();
    }, 2500);
    
  } catch (error) {
    console.error('❌ Error completo:', error);
    mostrarAlerta(error.message, 'error');
  }
}

   // ============================================
// GESTIÓN DE TECLADO MÓVIL
// ============================================
function configurarScrollInputs() {
  // Detectar cuando cualquier input recibe foco
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      console.log('📱 Input enfocado:', e.target.id);
      
      // Agregar clase al body para padding extra
      document.body.classList.add('input-activo');
      
      // Esperar a que el teclado se abra (300ms) y hacer scroll
      setTimeout(() => {
        // Scroll suave al input
        e.target.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
        
        // Scroll adicional para asegurar visibilidad
        setTimeout(() => {
          window.scrollBy({
            top: -50, // Ajustar 50px arriba para mejor visibilidad
            behavior: 'smooth'
          });
        }, 100);
      }, 300);
    }
  });
  
  // Detectar cuando el input pierde foco
  document.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      console.log('📱 Input desenfocado');
      
      // Remover clase después de un delay
      setTimeout(() => {
        // Solo remover si ningún otro input está enfocado
        if (!document.activeElement || 
            (document.activeElement.tagName !== 'INPUT' && 
             document.activeElement.tagName !== 'TEXTAREA' &&
             document.activeElement.tagName !== 'SELECT')) {
          document.body.classList.remove('input-activo');
        }
      }, 100);
    }
  });
  
  // Detectar cambio de tamaño del viewport (cuando se abre/cierra el teclado)
  let lastHeight = window.innerHeight;
  window.addEventListener('resize', () => {
    const currentHeight = window.innerHeight;
    
    if (currentHeight < lastHeight) {
      // Teclado se abrió
      console.log('⌨️ Teclado abierto');
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          activeElement.tagName === 'SELECT')) {
        setTimeout(() => {
          activeElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }, 100);
      }
    } else {
      // Teclado se cerró
      console.log('⌨️ Teclado cerrado');
    }
    
    lastHeight = currentHeight;
  });
}

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  // ... código existente ...
  
  // ✅ AGREGAR AL FINAL:
  configurarScrollInputs();
  
  console.log('✅ Sistema de scroll para inputs configurado');
});

