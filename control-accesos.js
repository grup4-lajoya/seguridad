// ============================================
// CONTROL DE ACCESOS - SISTEMA DE SEGURIDAD
// ============================================

// Elementos del DOM
const elements = {
  inputCodigo: document.getElementById('inputCodigo'),
  btnBuscar: document.getElementById('btnBuscar'),
  btnLimpiar: document.getElementById('btnLimpiar'),
  resultado: document.getElementById('resultado'),
  alerta: document.getElementById('alerta')
};

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
  }
  
  // Alfanumérico (placa)
  if (/^[A-Z0-9-]{5,7}$/.test(limpio)) {
    return { tipo: 'placa', valor: limpio };
  }
  
  return { tipo: 'desconocido', valor: limpio };
}

// ============================================
// FUNCIONES DE UI
// ============================================
function mostrarAlerta(mensaje, tipo = 'info') {
  const iconos = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  elements.alerta.className = `alert alert-${tipo}`;
  elements.alerta.innerHTML = `
    <span class="alert-icon">${iconos[tipo]}</span>
    <div class="alert-content">${mensaje}</div>
  `;
  elements.alerta.classList.remove('hidden');
}

function ocultarAlerta() {
  elements.alerta.classList.add('hidden');
}

function limpiarResultado() {
  elements.resultado.innerHTML = '';
  elements.resultado.classList.add('hidden');
  ocultarAlerta();
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
  const esForaneo = data.origen === 'foraneo';
  const tieneVehiculos = data.vehiculos && data.vehiculos.length > 0;
  const tieneIngresoActivo = data.ingreso_activo !== null;
  const esSalida = tieneIngresoActivo;
  
  // Si es salida, mostrar info del ingreso
  let infoIngreso = '';
  if (esSalida && data.ingreso_activo) {
    const fechaIngreso = new Date(data.ingreso_activo.fecha_ingreso);
    const horaIngreso = fechaIngreso.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    
    infoIngreso = `
      <div class="alert alert-info" style="margin: 16px 0;">
        <span>ℹ️</span>
        <div>
          <strong>Ingresó a las ${horaIngreso}</strong>
         ${data.ingreso_activo.ingreso_original_con_vehiculo ? '<br>Con vehículo' : '<br>Sin vehículo'}
        </div>
      </div>
    `;
  }
  
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon">${esSalida ? '🚪' : '👤'}</div>
        <div>
          <h3>${data.nombre}</h3>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <span class="badge badge-${esForaneo ? 'warning' : 'primary'}">
              ${esForaneo ? 'Personal Foráneo' : 'Personal'}
            </span>
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
        
        ${infoIngreso}
      </div>

${esSalida ? `
  <!-- Es SALIDA -->
 ${tieneVehiculos ? `
  <div class="alert alert-info" style="margin: 16px 0;">
    <span>🚗</span>
    <div>
      <strong>¿Sale con vehículo?</strong>
    </div>
  </div>
  
  <div class="resultado-actions">
    <button class="btn" style="background: #10B981; color: white;" onclick='solicitarPlacaSalida(${JSON.stringify(data)})'>
      ✅ Sí, con vehículo
    </button>
    <button class="btn" style="background: #EF4444; color: white;" onclick="registrarIngreso('${data.id}', '${data.origen}')">
      🚶 No, sin vehículo
    </button>
  </div>
  ` : `
    <div class="resultado-actions">
      <button class="btn" style="background: #EF4444; color: white;" onclick="registrarIngreso('${data.id}', '${data.origen}')">
        🚪 Registrar Salida
      </button>
    </div>
  `}
      ` : tieneVehiculos ? `
        <!-- Es INGRESO con vehículos - Preguntar -->
        <div class="alert alert-info" style="margin: 16px 0;">
          <span>🚗</span>
          <div>
            <strong>¿Ingresó con su vehículo?</strong>
          </div>
        </div>
        
        <div class="resultado-actions">
          <button class="btn btn-success" onclick='mostrarVehiculosPersona(${JSON.stringify(data)})'>
            ✅ Sí, con vehículo
          </button>
          <button class="btn btn-primary" onclick="registrarIngreso('${data.id}', '${data.origen}')">
            🚶 No, sin vehículo
          </button>
        </div>
      ` : `
        <!-- Es INGRESO sin vehículos - Botón simple -->
        <div class="resultado-actions">
          <button class="btn btn-success" onclick="registrarIngreso('${data.id}', '${data.origen}')">
            ✅ Registrar Ingreso
          </button>
        </div>
      `}
    </div>
  `;
  
  elements.resultado.classList.remove('hidden');
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
        tipo: 'placa'
      }),
    });
const resultado = await response.json();

// Si el vehículo NO existe, crearlo como temporal
if (!resultado.success) {
  mostrarAlerta('Vehículo no encontrado, registrando como temporal...', 'info');
  
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
        id_usuario: idUsuario
      }),
    });
    
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
                  onclick="solicitarConductorSalida('${data.id}', '${data.ingreso_activo.id_persona}', '${data.ingreso_activo.tipo_persona}')">
            👤 ¿Quién conduce?
          </button>
        ` : `
          <button class="btn btn-primary" onclick="solicitarConductor('${data.id}')">
            👤 ¿Quién conduce?
          </button>
        `}
      </div>
    </div>
  `;
  
  elements.resultado.classList.remove('hidden');
}

function solicitarConductorSalida(vehiculoId, idPersonaIngreso, tipoPersonaIngreso) {
  console.log('👤 Solicitar conductor para SALIDA del vehículo:', vehiculoId);
  
  // Guardar datos del vehículo y persona que ingresó
  window.vehiculoEnProcesoSalida = {
    vehiculoId,
    idPersonaIngreso,
    tipoPersonaIngreso
  };
  
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
        <div class="alert alert-info" style="margin-bottom: 16px;">
          <span>ℹ️</span>
          <div>
            <strong>Puede ser la misma persona que ingresó o una diferente</strong>
          </div>
        </div>
        
        <div class="input-group">
          <label for="inputConductorSalida">Escanea NSA o DNI del conductor:</label>
          <input 
            type="text" 
            id="inputConductorSalida" 
            placeholder="Ej: 97778, 46025765"
            autocomplete="off"
            style="text-align: center; text-transform: uppercase;"
          >
        </div>
      </div>

      <div class="resultado-actions">
        <button class="btn" style="background: #EF4444; color: white;" onclick="buscarConductorSalida()">
          🔍 Buscar Conductor
        </button>
        <button class="btn" style="background: #6B7280; color: white;" onclick="limpiarResultado()">
          ✕ Cancelar
        </button>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    document.getElementById('inputConductorSalida').focus();
    document.getElementById('inputConductorSalida').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        buscarConductorSalida();
      }
    });
  }, 100);
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
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        codigo: deteccion.valor,
        tipo: deteccion.tipo
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
    
    const deteccion = detectarTipoCodigo(codigo);
    
    console.log('🔍 Tipo detectado:', deteccion.tipo);
    console.log('📝 Valor:', deteccion.valor);
    
    if (deteccion.tipo === 'desconocido') {
      throw new Error('Código no reconocido. Debe ser NSA (5-6 dígitos), DNI (8 dígitos) o Placa (5-7 caracteres)');
    }
    
    // Llamar a Edge Function SIN autorización
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        codigo: deteccion.valor,
        tipo: deteccion.tipo
      }),
    });
    
    const resultado = await response.json();
    console.log('📦 Resultado:', resultado);
    
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

async function registrarIngreso(personaId, origen) {
  try {
    console.log('📝 Registrando ingreso/salida:', personaId, origen);
    
    // Obtener ID del usuario actual
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
        id_persona: personaId,
        tipo_persona: origen,
        id_vehiculo: null,
        ingreso_con_vehiculo: false,
        id_usuario: idUsuario
      }),
    });
    
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
  console.log('👤 Solicitar conductor para vehículo:', vehiculoId);
  
  // Guardar el ID del vehículo en una variable global temporal
  window.vehiculoEnProceso = vehiculoId;
  
  // Cambiar la UI para solicitar conductor
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon">👤</div>
        <div>
          <h3>Identificar Conductor</h3>
          <span class="badge badge-primary">Paso 2 de 2</span>
        </div>
      </div>
      
      <div class="resultado-body">
        <div class="input-group">
          <label for="inputConductor">Escanea NSA o DNI del conductor:</label>
          <input 
            type="text" 
            id="inputConductor" 
            placeholder="Ej: 97778, 46025765"
            autocomplete="off"
            style="text-align: center; text-transform: uppercase;"
          >
        </div>
      </div>

      <div class="resultado-actions">
        <button class="btn btn-success" onclick="buscarConductor()">
          🔍 Buscar Conductor
        </button>
        <button class="btn" style="background: #6B7280; color: white;" onclick="limpiarResultado()">
          ✕ Cancelar
        </button>
      </div>
    </div>
  `;
  
  // Enfocar el input
  setTimeout(() => {
    document.getElementById('inputConductor').focus();
    
    // Permitir buscar con Enter
    document.getElementById('inputConductor').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        buscarConductor();
      }
    });
  }, 100);
}
// Busca esta función en tu archivo control-accesos.js (línea 834)
// Reemplaza desde la línea 856 hasta la línea 881

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
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        codigo: deteccion.valor,
        tipo: deteccion.tipo
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
        id_usuario: idUsuario
      }),
    });
    
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
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon">🚗</div>
        <div>
          <h3>Escanear Vehículo de Salida</h3>
          <span class="badge badge-primary">${persona.nombre}</span>
        </div>
      </div>
      
      <div class="resultado-body">
        <div class="input-group">
          <label for="inputPlacaSalida">Escanea la placa del vehículo:</label>
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
          🔍 Buscar y Registrar Salida
        </button>
        <button class="btn" style="background: #6B7280; color: white;" onclick='mostrarPersona(${JSON.stringify(persona)})'>
          ← Volver
        </button>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    document.getElementById('inputPlacaSalida').focus();
    
    document.getElementById('inputPlacaSalida').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        procesarSalidaConVehiculo();
      }
    });
  }, 100);
  
  // Guardar persona en variable global
  window.personaSalida = persona;
}

async function procesarSalidaConVehiculo() {
  try {
    const inputPlaca = document.getElementById('inputPlacaSalida');
    const placa = inputPlaca.value.trim().toUpperCase();
    
    if (!placa) {
      mostrarAlerta('Por favor ingresa la placa del vehículo', 'error');
      return;
    }
    
    mostrarAlerta('Buscando vehículo...', 'info');
    
    // Buscar el vehículo
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.BUSCAR_CODIGO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        codigo: placa,
        tipo: 'placa'
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
  throw new Error(`El vehículo ${placa} no está dentro de las instalaciones. Debe ingresar primero.`);
}

// Registrar salida con vehículo
    
    // Registrar salida con vehículo
    const sesion = JSON.parse(localStorage.getItem('sesion'));
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
        id_vehiculo: resultado.data.id,
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
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  }
}

// ============================================
// EVENTOS
// ============================================
elements.btnBuscar.addEventListener('click', () => {
  const codigo = elements.inputCodigo.value.trim();
  
  if (!codigo) {
    mostrarAlerta('Por favor ingresa un código', 'error');
    return;
  }
  
  buscarCodigo(codigo);
});

elements.inputCodigo.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    elements.btnBuscar.click();
  }
});

elements.btnLimpiar.addEventListener('click', () => {
  elements.inputCodigo.value = '';
  limpiarResultado();
  elements.inputCodigo.focus();
});

// ============================================
// VERIFICAR AUTENTICACIÓN
// ============================================
function verificarAuth() {
  const sesion = localStorage.getItem('sesion');
  if (!sesion) {
    window.location.href = 'index.html';
  }
}
// Inicializar
verificarAuth();
elements.inputCodigo.focus();

async function crearVehiculoTemporal(placa, persona) {
  const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/vehiculo_seguridad`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      id_propietario: persona.id,
      tipo_propietario: persona.origen === 'foraneo' ? 'personal_foraneo' : 'personal',
      placa: placa,
      tipo_vehiculo: 'AUTO',
      tipo_propiedad: 'PRESTADO',
      marca: 'TEMPORAL',
      modelo: 'TEMPORAL',
      color: 'N/A',
      temporal: true,
      activo: true
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error('Error al registrar vehículo temporal');
  }
  
  console.log('✅ Vehículo temporal creado:', data);
  return data[0].id;
}
