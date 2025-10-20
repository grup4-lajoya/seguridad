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
}

// ============================================
// FUNCIONES DE UI
// ============================================
function mostrarAlerta(mensaje, tipo = 'info') {
  const iconos = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  }

  elements.alert.className = `alert alert-${tipo}`
  elements.alert.innerHTML = `<span>${iconos[tipo]}</span><div>${mensaje}</div>`
  elements.alert.classList.remove('hidden')
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
  
  // Auto-completar el código
  elements.codigo.value = resultado.codigo
  elements.codigo.focus()
  
  iniciarTemporizador(CONFIG.APP.TIMEOUT_OTP)
  
  // Mostrar información completa del código
  mostrarAlerta(
    `<div style="text-align: center;">
      <strong style="font-size: 16px;">✅ Código generado correctamente</strong>
      
      <div class="codigo-display">
        <div style="font-size: 14px; opacity: 0.9;">Tu código de acceso es:</div>
        <div class="codigo-numero">${resultado.codigo}</div>
        <div style="font-size: 12px; opacity: 0.8;">⏰ Válido por 10 minutos</div>
      </div>
      
      <div class="usuario-info">
        <div style="margin-bottom: 8px;"><strong>Información del usuario:</strong></div>
        <div>👤 Nombre: <strong>${resultado.usuario.nombre}</strong></div>
        <div>🏢 Unidad: <strong>${resultado.usuario.unidad || 'N/A'}</strong></div>
        <div>📍 Puesto: <strong>${resultado.usuario.puesto_servicio || 'N/A'}</strong></div>
      </div>
      
      <div style="margin-top: 15px; color: #6b7280; font-size: 13px; line-height: 1.5;">
        El código ya está ingresado automáticamente.<br>
        Solo haz clic en <strong>"Verificar e ingresar"</strong>
      </div>
    </div>`,
    'success'
  )
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
function guardarSesion(token, usuario) {
  window.sessionData = {
    token,
    usuario,
    timestamp: Date.now()
  }
}

function obtenerSesion() {
  return window.sessionData || null
}

function limpiarSesion() {
  window.sessionData = null
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
    mostrarAlerta(`Error: ${error.message}`, 'error')
  } finally {
    ocultarSpinner(elements.btnSolicitarOTP)
  }
})

elements.formOTP.addEventListener('submit', async (e) => {
  e.preventDefault()
  
  const codigo = elements.codigo.value.trim()
  
  if (!codigo || codigo.length !== 6) {
    mostrarAlerta('El código debe tener 6 dígitos', 'error')
    return
  }

  mostrarSpinner(elements.btnVerificarOTP, 'Verificar e ingresar')
  ocultarAlerta()

  try {
    const resultado = await verificarOTP(state.identificadorActual, codigo)
    
    // Guardar sesión
    guardarSesion(resultado.token, resultado.usuario)
    
    // Mostrar mensaje de éxito
    mostrarAlerta(`¡Bienvenido ${resultado.usuario.nombre}!`, 'success')
    
    // Redirigir al dashboard después de 1 segundo
    setTimeout(() => {
      window.location.href = CONFIG.RUTAS.DASHBOARD
    }, 1000)
    
  } catch (error) {
    mostrarAlerta(error.message, 'error')
  } finally {
    ocultarSpinner(elements.btnVerificarOTP)
  }
})

elements.btnVolver.addEventListener('click', () => {
  mostrarFormIdentificador()
})

// Solo permitir números en el campo de código
elements.codigo.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '')
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
  
  // Verificar si ya hay una sesión activa
  const sesionValida = await verificarSesionActiva()
  
  if (sesionValida) {
    window.location.href = CONFIG.RUTAS.DASHBOARD
  } else {
    limpiarSesion()
    mostrarFormIdentificador()
  }
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
