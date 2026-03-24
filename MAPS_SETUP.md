# 🗺️ Sistema de Geolocalización y Mapas

Este documento describe la implementación del sistema de geolocalización, mapas y tracking en tiempo real para el sistema de delivery.

## Características

### 1. **Administrador - Editor de Zonas de Delivery**
- Dibuja polígonos directamente en el mapa para definir áreas de cobertura
- Asigna colores diferentes a cada zona
- Visualiza la ubicación de las sucursales
- Gestiona costos de envío por zona

### 2. **Administrador - Mapa de Repartidores en Tiempo Real**
- Visualiza todos los repartidores en un mapa
- Indicadores de disponibilidad y estado de entrega
- Información en tiempo real de ubicación
- Acceso rápido desde el menú "Live Tracking"

### 3. **Checkout - Selector de Dirección con Mapa**
- Los clientes seleccionan su ubicación exacta en el mapa
- Búsqueda de direcciones con autocompletado
- Detección automática de zona de delivery
- Validación visual de cobertura

### 4. **Tracking del Pedido - Mapa en Vivo**
- El cliente ve la ubicación del repartidor en tiempo real
- Estimación de distancia y tiempo de llegada
- Actualizaciones automáticas cada 10 segundos
- Indicador visual en vivo (pulsing marker)

### 5. **Driver App - Ubicación y Navegación**
- Envío automático de ubicación GPS cada 10 segundos
- Mapa con ruta al destino
- Botón de navegación integrado con Google Maps
- Indicador de estado GPS activo

## Configuración

### 1. Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita las siguientes APIs:
   - **Maps JavaScript API **
   - **Places API gratis hasta 5k de recurssos luego cobra 17 dolares cada 1k de recuross**
   - **Geocoding API costo hasta 10k recursos x mes gratis luego de ahi 5usd cada 1 k de recursos**

### 2. Obtener API Key

1. Ve a "Credentials" en el menú lateral
2. Clic en "Create Credentials" → "API Key"
3. Copia la API key generada
4. (Opcional) Restringe la key por:
   - Aplicaciones HTTP (referrers)
   - APIs específicas

### 3. Configurar Variables de Entorno

Agrega a tu archivo `.env`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_api_key_aqui
NEXT_PUBLIC_GOOGLE_MAPS_ID=optional_map_id
```

### 4. Configurar Map ID (Opcional)

Para personalizar el estilo del mapa:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Navega a "Map Management"
3. Crea un nuevo Map ID
4. Selecciona el estilo deseado
5. Agrega el ID a tu `.env`

## Migraciones de Base de Datos

Ejecuta el script de migración en Supabase:

```bash
# En el SQL Editor de Supabase, ejecutar:
scripts/006_geolocation_and_maps.sql
```

Esta migración agrega:
- Coordenadas a las sucursales (`lat`, `lng`)
- Coordenadas a los pedidos (`address_lat`, `address_lng`)
- Tabla de histórico de ubicaciones de repartidores
- Funciones para búsqueda de zonas por coordenadas
- Triggers para actualización automática de ubicación

## Estructura de Componentes

```
components/maps/
├── google-maps-provider.tsx    # Provider de Google Maps
├── map-view.tsx                 # Vista de mapa básica
├── polygon.tsx                  # Componente de polígono
├── zone-editor.tsx              # Editor de zonas de delivery
├── address-selector.tsx         # Selector de dirección
├── live-tracking-map.tsx        # Mapa de tracking en vivo
├── drivers-overview-map.tsx     # Vista general de repartidores
└── index.ts                     # Exports
```

## Uso de Componentes

### Editor de Zonas

```tsx
import { ZoneEditor, GoogleMapsProvider } from "@/components/maps"

<GoogleMapsProvider>
  <ZoneEditor
    initialCoordinates={zone.coordinates}
    center={{ lat: -34.6037, lng: -58.3816 }}
    branchMarker={{ lat: -34.6037, lng: -58.3816, title: "Sucursal" }}
    zoneColor="#3b82f6"
    onChange={(coordinates) => setCoordinates(coordinates)}
    height="400px"
  />
</GoogleMapsProvider>
```

### Selector de Dirección

```tsx
import { AddressSelector, GoogleMapsProvider } from "@/components/maps"

<GoogleMapsProvider>
  <AddressSelector
    value={selectedLocation}
    onChange={setSelectedLocation}
    zones={deliveryZones}
    height="300px"
  />
</GoogleMapsProvider>
```

### Tracking en Vivo

```tsx
import { LiveTrackingMap, GoogleMapsProvider } from "@/components/maps"

<GoogleMapsProvider>
  <LiveTrackingMap
    orderId={order.id}
    driverId={order.driverId}
    destination={{ lat, lng, address }}
    branchLocation={{ lat, lng }}
    height="350px"
  />
</GoogleMapsProvider>
```

### Vista General de Repartidores

```tsx
import { DriversOverviewMap, GoogleMapsProvider } from "@/components/maps"

<GoogleMapsProvider>
  <DriversOverviewMap height="600px" />
</GoogleMapsProvider>
```

## Hook de Ubicación del Driver

```tsx
import { useDriverLocation } from "@/hooks/use-driver-location"

const { isTracking, lastLocation, error } = useDriverLocation({
  driverId: "uuid-del-driver",
  enabled: true,
  interval: 10000, // 10 segundos
  onError: (err) => console.error(err),
})
```

## APIs Adicionales

### Actualizar Ubicación del Driver

```typescript
import { updateDriverLocation } from "@/app/actions"

await updateDriverLocation(driverId, lat, lng)
```

### Buscar Zona por Coordenadas

```sql
-- Función SQL disponible en Supabase
SELECT * FROM find_zone_by_coordinates(-34.6037, -58.3816, branch_id)
```

## Consideraciones de Rendimiento

1. **Rate Limits**: Google Maps API tiene límites de uso gratuito:
   - 28,500 cargas de mapa por mes
   - Límites adicionales para Places y Geocoding

2. **Optimización de Costos**:
   - Usa `NEXT_PUBLIC_GOOGLE_MAPS_ID` para habilitar caché
   - Implementa debounce en búsquedas
   - Limita actualizaciones de ubicación a 10s

3. **Seguridad**:
   - Restringe la API key por dominio
   - Nunca expongas la API key en el servidor
   - Usa variables de entorno

## Solución de Problemas

### El mapa no carga
- Verifica que la API key esté configurada correctamente
- Asegúrate de que las APIs necesarias estén habilitadas
- Revisa la consola del navegador por errores

### Ubicación no disponible
- El usuario debe permitir acceso a la ubicación
- En desarrollo local, usa HTTPS o localhost
- Algunos navegadores bloquean geolocalización en HTTP

### Zonas no detectadas
- Verifica que las coordenadas del polígono sean correctas
- El algoritmo point-in-polygon requiere al menos 3 puntos
- Considera usar PostGIS para cálculos más precisos

## Mejoras Futuras

- [ ] Integración con rutas de Google Directions API
- [ ] Cálculo de tiempo estimado con tráfico real
- [ ] Notificaciones push cuando el repartidor esté cerca
- [ ] Historial de rutas de repartidores
- [ ] Análisis de zonas más rentables
- [ ] Optimización automática de zonas basada en pedidos
