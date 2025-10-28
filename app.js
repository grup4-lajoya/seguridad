// ============================================
// ELEMENTOS DEL DOM
// ============================================
const elements = {
  alert: document.getElementById('alert'),
  formIdentificador: document.getElementById('formIdentificador'),
  formOTP: document.getElementById('formOTP'),
  identificador: document.getElementById('identificador'),
  codigo: document.getElementById('codigo'),
  btnSolicitarOTP: document.getElementById('btnSolicitarOTP'),
  btnVerificarOTP: document.getElementById('btnVerificarOTP'),
  btnVolver: document.getElementById('btnVolver'),
  timer: document.getElementById('timer'),
  countdown: document.getElementById('countdown'),
}

// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================
let state = {
  identificadorActual: '',
  tiempoRestante: 0,
  intervalId: null,
  deviceFingerprint: null, // Guardar el fingerprint
}

// ============================================
// FUNCIONES DE UI
// ============================================
// ============================================
// MOSTRAR ALERTAS (SISTEMA DE TOASTS)
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
  elements.alert.classList.add('hidden')
}

function mostrarSpinner(boton, textoOriginal) {
  boton.disabled = true
  boton.dataset.originalText = textoOriginal
  boton.innerHTML = '<div class="spinner"></div><span>Procesando...</span>'
}

function ocultarSpinner(boton) {
  boton.disabled = false
  boton.innerHTML = boton.dataset.originalText
}

function mostrarFormIdentificador() {
  elements.formIdentificador.classList.remove('hidden')
  elements.formOTP.classList.add('hidden')
  elements.identificador.value = ''
  elements.identificador.focus()
  detenerTemporizador()
  ocultarAlerta()
}
function mostrarFormOTPConCodigo(resultado) {
  elements.formIdentificador.classList.add('hidden')
  elements.formOTP.classList.remove('hidden')
  
  // Auto-completar el código (oculto)
  elements.codigo.value = resultado.codigo
  
  iniciarTemporizador(CONFIG.APP.TIMEOUT_OTP)
  
  // Mostrar información COMPACTA
  mostrarAlerta(
    `<div style="text-align: center;">
      <div style="font-size: 16px; font-weight: 600; color: #059669; margin-bottom: 12px;">
        ✅ Código Generado
      </div>
      
      <div style="background: #f0f9ff; padding: 12px; border-radius: 8px; border: 2px solid #3b82f6; text-align: left; font-size: 13px; line-height: 1.6;">
        <div style="margin: 4px 0;"><strong>👤 ${resultado.usuario.nombre}</strong></div>
        <div style="margin: 4px 0; color: #6b7280;">🏢 ${resultado.usuario.unidad || 'N/A'}</div>
        <div style="margin: 4px 0; color: #6b7280;">📍 ${resultado.usuario.puesto_servicio || 'N/A'}</div>
      </div>
      
      <div style="margin-top: 10px; font-size: 12px; color: #6b7280;">
        Presiona <strong style="color: #4F46E5;">"Verificar e Ingresar"</strong>
      </div>
    </div>`,
    'success'
  )
  
  // Auto-focus en el botón de verificar
  setTimeout(() => {
    elements.btnVerificarOTP.focus()
  }, 100)
}

function iniciarTemporizador(segundos) {
  state.tiempoRestante = segundos
  elements.timer.classList.remove('hidden')
  
  actualizarDisplay()
  
  state.intervalId = setInterval(() => {
    state.tiempoRestante--
    
    if (state.tiempoRestante <= 0) {
      detenerTemporizador()
      mostrarAlerta('El código ha expirado. Solicita uno nuevo.', 'error')
      mostrarFormIdentificador()
    } else {
      actualizarDisplay()
    }
  }, 1000)
}

function detenerTemporizador() {
  if (state.intervalId) {
    clearInterval(state.intervalId)
    state.intervalId = null
  }
  elements.timer.classList.add('hidden')
}

function actualizarDisplay() {
  const minutos = Math.floor(state.tiempoRestante / 60)
  const segundos = state.tiempoRestante % 60
  elements.countdown.textContent = 
    `${minutos}:${segundos.toString().padStart(2, '0')}`
}

// ============================================
// ALMACENAMIENTO SEGURO (EN MEMORIA)
// ============================================
// Cambiar la función guardarSesion en app.js
// ============================================
// ALMACENAMIENTO SEGURO (sessionStorage)
// ============================================
function guardarSesion(token, usuario) {
  const sesionData = {
    token,
    usuario,
    timestamp: Date.now()
  };
  
  // Usar localStorage en lugar de sessionStorage
  localStorage.setItem('sesion', JSON.stringify(sesionData));
  window.sessionData = sesionData;
}

function obtenerSesion() {
  const sesionGuardada = localStorage.getItem('sesion');
  if (sesionGuardada) {
    const sesion = JSON.parse(sesionGuardada);
    window.sessionData = sesion;
    return sesion;
  }
  return window.sessionData || null;
}

function limpiarSesion() {
  localStorage.removeItem('sesion');
  window.sessionData = null;
}

// ============================================
// LLAMADAS A LA API (Edge Functions) - CON DEBUG
// ============================================
async function solicitarOTP(identificador) {
  try {
    console.log('🔍 Solicitando OTP para:', identificador)
    console.log('📡 URL:', CONFIG.EDGE_FUNCTIONS.SOLICITAR_OTP)
    
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.SOLICITAR_OTP, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ identificador }),
    })

    console.log('📥 Status:', response.status)
    console.log('📥 Status Text:', response.statusText)

    const data = await response.json()
    console.log('📦 Respuesta completa:', data)

    if (!data.success) {
      throw new Error(data.error || 'Error al solicitar código')
    }

    return data
  } catch (error) {
    console.error('❌ Error en solicitarOTP:', error)
    console.error('❌ Error completo:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    throw error
  }
}

async function verificarOTP(identificador, codigo) {
  try {
    console.log('🔐 Verificando OTP:', { identificador, codigo })
    
    const dispositivo = navigator.userAgent
    const ip = 'N/A'

    const response = await fetch(CONFIG.EDGE_FUNCTIONS.VERIFICAR_OTP, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        identificador,
        codigo,
        dispositivo,
        ip,
        deviceFingerprint: state.deviceFingerprint, // Enviar el fingerprint
      }),
    })

    console.log('📥 Status verificación:', response.status)
    
    const data = await response.json()
    console.log('📦 Respuesta verificación:', data)

    if (!data.success) {
      throw new Error(data.error || 'Código incorrecto')
    }

    return data
  } catch (error) {
    console.error('❌ Error en verificarOTP:', error)
    throw error
  }
}

async function verificarSesionActiva() {
  try {
    const sesion = obtenerSesion()
    if (!sesion) return false

    const response = await fetch(CONFIG.EDGE_FUNCTIONS.VERIFICAR_SESION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sesion.token}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
    })

    const data = await response.json()
    return data.valido
  } catch (error) {
    console.error('Error al verificar sesión:', error)
    return false
  }
}

// ============================================
// MANEJADORES DE EVENTOS
// ============================================
elements.formIdentificador.addEventListener('submit', async (e) => {
  e.preventDefault()
  
  const identificador = elements.identificador.value.trim()
  
  if (!identificador) {
    mostrarAlerta('Por favor ingresa tu NSA o DNI', 'error')
    return
  }

  mostrarSpinner(elements.btnSolicitarOTP, 'Generar código de verificación')
  ocultarAlerta()

  try {
    const resultado = await solicitarOTP(identificador)
    
    state.identificadorActual = identificador
    
    // Mostrar el código en pantalla
    mostrarFormOTPConCodigo(resultado)
    
  } catch (error) {
    console.error('❌ Error capturado:', error)
    
    // Si el error es por dispositivo no autorizado, mostrar el fingerprint
    if (error.message && (
      error.message.includes('DISPOSITIVO_NO_AUTORIZADO') || 
      error.message.includes('no está autorizado')
    )) {
      mostrarAlerta(
        `<div style="text-align: center;">
          <strong style="font-size: 16px;">🚫 Dispositivo no autorizado</strong>
          
          <div style="margin: 20px 0; padding: 15px; background: #f3f4f6; border-radius: 8px;">
            <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">
              Código del dispositivo:
            </div>
            <div style="font-size: 14px; font-family: monospace; font-weight: bold; color: #1f2937; word-break: break-all;">
              ${state.deviceFingerprint}
            </div>
          </div>
          
          <div style="font-size: 13px; color: #6b7280; line-height: 1.6;">
            Este dispositivo no está registrado.<br>
            <strong>Copia el código de arriba</strong> y envíalo al administrador para autorizar este equipo.
          </div>
        </div>`,
        'error'
      )
    } else {
      mostrarAlerta(`Error: ${error.message}`, 'error')
    }
  } finally {
    ocultarSpinner(elements.btnSolicitarOTP)
  }
})

elements.formOTP.addEventListener('submit', async (e) => {
  e.preventDefault()
  
  console.log('🔵 Formulario OTP enviado')
  
  const codigo = elements.codigo.value.trim()
  
  // Validación simple ya que el código se auto-completa
  if (!codigo) {
    mostrarAlerta('Error: No se detectó código de verificación', 'error')
    return
  }

  mostrarSpinner(elements.btnVerificarOTP, 'Verificar e ingresar')
  ocultarAlerta()

  try {
    console.log('🔵 Verificando OTP...')
    const resultado = await verificarOTP(state.identificadorActual, codigo)
    console.log('🔵 Resultado verificación:', resultado)
    
    // Guardar sesión
    console.log('🔵 Guardando sesión...')
    guardarSesion(resultado.token, resultado.usuario)
    
    // Verificar que se guardó correctamente
    const sesionGuardada = localStorage.getItem('sesion')
    console.log('✅ Sesión guardada en localStorage:', sesionGuardada)
    
    // Parsear y mostrar
    if (sesionGuardada) {
      const parsed = JSON.parse(sesionGuardada)
      console.log('✅ Sesión parseada:', parsed)
    }
    
    // Mostrar mensaje de éxito
    mostrarAlerta(`¡Bienvenido ${resultado.usuario.nombre}!`, 'success')
    
    // PAUSAR ANTES DE REDIRIGIR
    //alert('SESIÓN GUARDADA - Revisa la consola antes de dar OK')
    
    // Redirigir
    console.log('🔵 Redirigiendo a dashboard...')
    window.location.href = 'dashboard.html' 
    
  } catch (error) {
    console.error('❌ Error:', error)
    mostrarAlerta(error.message, 'error')
  } finally {
    ocultarSpinner(elements.btnVerificarOTP)
  }
})

elements.btnVolver.addEventListener('click', () => {
  mostrarFormIdentificador()
})

// ============================================
// INICIALIZACIÓN
// ============================================
async function init() {
  console.log('🚀 Iniciando aplicación...')
  console.log('⚙️ Configuración:', {
    url: CONFIG.SUPABASE_URL,
    hasAnon: !!CONFIG.SUPABASE_ANON_KEY,
    functions: CONFIG.EDGE_FUNCTIONS
  })
  
  // Generar device fingerprint
  state.deviceFingerprint = await generarDeviceFingerprint()
  console.log('📱 DEVICE FINGERPRINT:', state.deviceFingerprint)
  
  // Verificar si ya hay una sesión activa
  const sesionValida = await verificarSesionActiva()
  
  if (sesionValida) {
    window.location.href = CONFIG.RUTAS.DASHBOARD
    return; // ← AGREGAR RETURN AQUÍ
  }
  
  // Solo mostrar formulario si NO hay sesión válida
  mostrarFormIdentificador()
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
