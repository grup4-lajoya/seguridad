// ============================================
// DEVICE FINGERPRINTING - VERSIÓN COMPARTIDA
// Este archivo debe ser usado por todas las páginas
// ============================================

async function generarDeviceFingerprint() {
  const componentes = [];

  // 1. User Agent
  componentes.push(navigator.userAgent);

  // 2. Idioma
  componentes.push(navigator.language);

  // 3. Zona horaria
  componentes.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // 4. Resolución de pantalla
  componentes.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

  // 5. Platform
  componentes.push(navigator.platform);

  // 6. Hardware Concurrency (núcleos del CPU)
  componentes.push(navigator.hardwareConcurrency || 0);

  // 7. Device Memory (RAM en GB)
  componentes.push(navigator.deviceMemory || 0);

  // 8. Canvas Fingerprint (único por dispositivo)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Security', 2, 2);
  componentes.push(canvas.toDataURL());

  // 9. WebGL Vendor y Renderer
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      componentes.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
      componentes.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
    }
  }

  // 10. Touch support
  componentes.push(navigator.maxTouchPoints || 0);

  // Concatenar todo y generar hash
  const cadena = componentes.join('|||');
  const hash = await simpleHash(cadena);
  
  return hash;
}

// Función de hash SHA-256
async function simpleHash(texto) {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Función para obtener información del dispositivo
function obtenerInfoDispositivo() {
  const ua = navigator.userAgent;
  
  // Detectar sistema operativo
  let sistemaOperativo = 'Desconocido';
  if (ua.includes('Android')) sistemaOperativo = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) sistemaOperativo = 'iOS';
  else if (ua.includes('Windows')) sistemaOperativo = 'Windows';
  else if (ua.includes('Mac')) sistemaOperativo = 'macOS';
  else if (ua.includes('Linux')) sistemaOperativo = 'Linux';

  // Detectar navegador
  let navegador = 'Desconocido';
  if (ua.includes('Chrome') && !ua.includes('Edg')) navegador = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) navegador = 'Safari';
  else if (ua.includes('Firefox')) navegador = 'Firefox';
  else if (ua.includes('Edg')) navegador = 'Edge';

  return {
    sistemaOperativo,
    navegador,
    resolucion: `${screen.width}x${screen.height}`,
    idioma: navigator.language,
    zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}
