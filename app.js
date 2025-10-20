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
  elements.alert.innerHTML = `<span>${iconos[tipo]}</span><span>${mensaje}</span>`
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

function mostrarFormOTP(emailOfuscado) {
  elements.formIdentificador.classList.add('hidden')
  elements.formOTP.classList.remove('hidden')
  elements.codigo.value = ''
  elements.codigo.focus()
  iniciarTemporizador(CONFIG.APP.TIMEOUT_OTP)
  
  mostrarAlerta(
    `Código enviado a <strong>${emailOfuscado}</strong>. Revisa tu bandeja de entrada.`,
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
// ALMACENAMIENTO SEGURO
// ============================================
function guardarSesion(token, usuario) {
  // Guardar en memoria (variables JavaScript)
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
// LLAMADAS A LA API (Edge Functions)
// ============================================
async function solicitarOTP(identificador) {
  try {
    const response = await fetch(CONFIG.EDGE_FUNCTIONS.SOLICITAR_OTP, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ identificador }),
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Error al solicitar código')
    }

    return data
  } catch (error) {
    console.error('Error en solicitarOTP:', error)
    throw error
  }
}

async function verificarOTP(identificador, codigo) {
  try {
    // Obtener información del dispositivo
    const dispositivo = navigator.userAgent
    const ip = 'N/A' // La IP se obtiene en el backend

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

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Código incorrecto')
    }

    return data
  } catch (error) {
    console.error('Error en verificarOTP:', error)
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

  mostrarSpinner(elements.btnSolicitarOTP, 'Enviar código de verificación')
  ocultarAlerta()

  try {
    const resultado = await solicitarOTP(identificador)
    
    state.identificadorActual = identificador
    mostrarFormOTP(resultado.email)
  } catch (error) {
    mostrarAlerta(error.message, 'error')
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
  // Verificar si ya hay una sesión activa
  const sesionValida = await verificarSesionActiva()
  
  if (sesionValida) {
    // Redirigir al dashboard si ya está autenticado
    window.location.href = CONFIG.RUTAS.DASHBOARD
  } else {
    // Limpiar cualquier sesión inválida
    limpiarSesion()
    // Mostrar formulario de login
    mostrarFormIdentificador()
  }
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
