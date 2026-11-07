import { defineBoot } from '#q-app/wrappers'
import axios from 'axios'

const apiBaseUrl =
  process.env.API_URL !== undefined
    ? process.env.API_URL
    : process.env.NODE_ENV === 'production'
      ? ''
      : 'http://localhost:5260'

const api = axios.create({ baseURL: apiBaseUrl })

// Agregar interceptor para incluir token de autenticación
api.interceptors.request.use(
  (config) => {
    // Obtener el token desde localStorage (fall back: 'token')
    const token = localStorage.getItem('authToken') || localStorage.getItem('token')

    if (token) {
      // Validar que el token no esté vacío o corrupto
      if (token.trim().length > 0) {
        config.headers.Authorization = `Bearer ${token}`

        // 📧 Log especial para endpoints de creación de cuenta
        const isAccountCreation =
          config.url.includes('/personal/with-account') ||
          config.url.includes('/vincular-personal') ||
          config.url.includes('/activar-cuenta')

        if (isAccountCreation) {
          // console.log('🔐 [CUENTA] Request a endpoint de cuenta:', {
          //   url: config.url,
          //   method: config.method,
          //   hasToken: true,
          //   tokenLength: token.length,
          //   data: config.data,
          // })
        } else {
          // console.log('📤 Request con token:', {
          //   url: config.url,
          //   method: config.method,
          //   hasToken: true,
          //   tokenLength: token.length,
          //   tokenPreview: token.substring(0, 20) + '...',
          // })
        }
      } else {
        // console.error('❌ Token vacío o corrupto en localStorage')
      }
    } else {
      // console.warn('⚠️ Request SIN token:', {
      //   url: config.url,
      //   method: config.method,
      //   localStorage: {
      //     authToken: localStorage.getItem('authToken') !== null,
      //     token: localStorage.getItem('token') !== null,
      //   },
      // })
    }

    return config
  },
  (error) => {
    // console.error('❌ Error en request interceptor:', error)
    return Promise.reject(error)
  },
)

// Interceptor de respuesta para manejar errores
api.interceptors.response.use(
  (response) => {
    // 📧 Log especial para respuestas de endpoints de cuenta
    const isAccountCreation =
      response.config.url.includes('/personal/with-account') ||
      response.config.url.includes('/vincular-personal') ||
      response.config.url.includes('/activar-cuenta')

    if (isAccountCreation) {
      // console.log('✅ [CUENTA] Respuesta del backend:', {
      //   url: response.config.url,
      //   status: response.status,
      //   data: response.data,
      // })
    }

    return response
  },
  async (error) => {
    const status = error.response?.status
    const config = error.config

    if (status === 401) {
      // Token expirado o inválido
      // console.warn('🔒 Token expirado o inválido (401)', {
      //   url: config?.url,
      //   method: config?.method,
      //   hasAuthHeader: !!config?.headers?.Authorization,
      //   responseData: error.response?.data,
      // })

      // Verificar si localStorage tiene token
      //const tokenInStorage = localStorage.getItem('authToken')
      // console.log('💾 Token en localStorage:', {
      //   exists: !!tokenInStorage,
      //   length: tokenInStorage?.length || 0,
      // })

      // ✨ NUEVA LÓGICA: Solo limpiar sesión y redirigir si:
      // 1. Es un endpoint crítico (login, datos de usuario, etc.)
      // 2. O si el error indica token expirado/inválido (no falta de permisos o claims)

      const url = config?.url || ''
      const esEndpointSecundario = url.includes('/reporte/') || url.includes('/export')
      const mensajeError =
        error.response?.data?.message || error.response?.data?.error || error.response?.data || ''
      const mensajeStr =
        typeof mensajeError === 'string' ? mensajeError : JSON.stringify(mensajeError)

      const esTokenExpirado =
        mensajeStr.toLowerCase().includes('expired') ||
        mensajeStr.toLowerCase().includes('token inválido') ||
        mensajeStr.toLowerCase().includes('invalid token')

      const esFaltaClaim =
        mensajeStr.toLowerCase().includes('claim') || mensajeStr.toLowerCase().includes('userid')

      // Solo limpiar sesión si es endpoint crítico Y (token expirado O no es falta de claim)
      if (!esEndpointSecundario && !esFaltaClaim) {
        // console.log('🧹 Limpiando sesión por 401 en endpoint crítico')

        // Importar authStore y limpiar sesión completa
        const { useAuthStore } = await import('src/stores/useAuthStore')
        const authStore = useAuthStore()
        authStore.clearAuth()

        // Redirigir al login si no estamos ya ahí
        const currentPath = window.location.pathname
        if (currentPath !== '/' && currentPath !== '/login') {
          // console.log('↪️ Redirigiendo a login...')
          window.location.href = '/login'
        }
      } else if (esTokenExpirado) {
        // console.log('🧹 Limpiando sesión por token expirado')

        const { useAuthStore } = await import('src/stores/useAuthStore')
        const authStore = useAuthStore()
        authStore.clearAuth()

        const currentPath = window.location.pathname
        if (currentPath !== '/' && currentPath !== '/login') {
          // console.log('↪️ Redirigiendo a login por token expirado')
          window.location.href = '/login'
        }
      } else {
        // Es un endpoint secundario con falta de permisos/claims - NO limpiar sesión
        if (esFaltaClaim) {
          // console.log(
          //   '⚠️ 401 por falta de claim (UserId) en endpoint secundario - NO se limpia sesión',
          // )
          // console.log(
          //   '💡 Sugerencia: El backend requiere claim "UserId" en el JWT para este endpoint',
          // )
        } else {
          // console.log(
          //   '⚠️ 401 en endpoint secundario - NO se limpia sesión (probablemente falta de permisos)',
          // )
        }
      }
    }

    return Promise.reject(error)
  },
)

export default defineBoot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api
  app.config.globalProperties.$axios = axios
  app.config.globalProperties.$api = api
})

export { api }
