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
    
    const deteccion = detectarTipoCodigo(codigo);
    
    console.log('🔍 Tipo detectado:', deteccion.tipo);
    console.log('📝 Valor:', deteccion.valor);
    
    if (deteccion.tipo === 'desconocido') {
      throw new Error('Código no reconocido. Debe ser NSA (5-6 dígitos), DNI (8 dígitos) o Placa (5-7 caracteres)');
    }
    
    // TODO: Llamar a Edge Function buscar-codigo
    // Por ahora, simulamos respuesta
    mostrarAlerta(`Tipo detectado: ${deteccion.tipo.toUpperCase()}. Próximamente buscaremos en la base de datos.`, 'info');
    
  } catch (error) {
    console.error('❌ Error:', error);
    mostrarAlerta(error.message, 'error');
  } finally {
    ocultarSpinner();
  }
}

function registrarIngreso(personaId, origen) {
  console.log('📝 Registrar ingreso:', personaId, origen);
  mostrarAlerta('Función de registro en desarrollo', 'info');
}

function solicitarConductor(vehiculoId) {
  console.log('👤 Solicitar conductor para vehículo:', vehiculoId);
  mostrarAlerta('Función de identificar conductor en desarrollo', 'info');
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
