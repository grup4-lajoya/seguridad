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
  
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon">👤</div>
        <div>
          <h3>${data.nombre}</h3>
          <span class="badge badge-${esForaneo ? 'warning' : 'primary'}">
            ${esForaneo ? 'Personal Foráneo' : 'Personal'}
          </span>
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
      </div>

      <div class="resultado-actions">
        <button class="btn btn-success" onclick="registrarIngreso('${data.id}', '${data.origen}')">
          ✅ Registrar Ingreso
        </button>
      </div>
    </div>
  `;
  
  elements.resultado.classList.remove('hidden');
}

function mostrarVehiculo(data) {
  const documentosVencidos = verificarDocumentosVencidos(data);
  
  elements.resultado.innerHTML = `
    <div class="resultado-card">
      <div class="resultado-header">
        <div class="resultado-icon">🚗</div>
        <div>
          <h3>${data.placa}</h3>
          <span class="badge badge-primary">Vehículo</span>
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
        
        ${documentosVencidos.length > 0 ? `
          <div class="alert alert-warning" style="margin-top: 16px;">
            <span>⚠</span>
            <div>
              <strong>Documentos vencidos:</strong><br>
              ${documentosVencidos.join('<br>')}
            </div>
          </div>
        ` : ''}
      </div>

      <div class="resultado-actions">
        <button class="btn btn-primary" onclick="solicitarConductor('${data.id}')">
          👤 ¿Quién conduce?
        </button>
      </div>
    </div>
  `;
  
  elements.resultado.classList.remove('hidden');
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
