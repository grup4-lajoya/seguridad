// ============================================
// CONFIGURACIÓN DE LA APLICACIÓN
// ============================================

const CONFIG = {
  // URL base de tu proyecto Supabase
  SUPABASE_URL: 'https://qgbixgvidxeaoxxpyiyw.supabase.co',
  
  // Anon key (pública, no es sensible)
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYml4Z3ZpZHhlYW94eHB5aXl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTU3NzMsImV4cCI6MjA3NTc3MTc3M30.NQ5n_vFnHDp8eNjV3I9vRujfWDWWGAywgyICpqX0OKQ',
  
  // URLs de las Edge Functions
EDGE_FUNCTIONS: {
  SOLICITAR_OTP: 'https://qgbixgvidxeaoxxpyiyw.supabase.co/functions/v1/solicitar-otp',
  VERIFICAR_OTP: 'https://qgbixgvidxeaoxxpyiyw.supabase.co/functions/v1/verificar-otp',
  VERIFICAR_SESION: 'https://qgbixgvidxeaoxxpyiyw.supabase.co/functions/v1/verificar-sesion',
  BUSCAR_CODIGO: 'https://qgbixgvidxeaoxxpyiyw.supabase.co/functions/v1/buscar-codigo',
  REGISTRAR_INGRESO_SALIDA: 'https://qgbixgvidxeaoxxpyiyw.supabase.co/functions/v1/registrar-ingreso-salida',
  REGISTRAR_VEHICULO_TEMPORAL: 'https://qgbixgvidxeaoxxpyiyw.supabase.co/functions/v1/registrar-vehiculo-temporal',
},
  
  // Configuración de la aplicación
  APP: {
    NOMBRE: 'Sistema de Seguridad',
    VERSION: '1.0.0',
    TIMEOUT_OTP: 600, // 10 minutos en segundos
  },
  
  // Rutas de la aplicación
  RUTAS: {
    LOGIN: 'index.html',
    DASHBOARD: 'dashboard.html',
  }
}

// ============================================
// INSTRUCCIONES PARA CONFIGURAR:
// ============================================
// 1. Ve a tu proyecto en Supabase
// 2. Settings → API
// 3. Copia la "URL" y reemplaza SUPABASE_URL
// 4. Copia "anon public" key y reemplaza SUPABASE_ANON_KEY
// 5. Las URLs de Edge Functions siguen el formato:
//    https://[TU-PROYECTO].supabase.co/functions/v1/[NOMBRE-FUNCION]
// ============================================
