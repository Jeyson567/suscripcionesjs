# JS Agency Manager

Sistema web profesional para administrar clientes, sistemas vendidos, ingresos y estadísticas de JS Agency.

## Tecnologías

- HTML5, CSS3, JavaScript Vanilla
- Firebase Firestore
- Chart.js, jsPDF, SheetJS (XLSX)

## Instalación

1. Abre la carpeta del proyecto con un servidor local (Live Server, o `npx serve .`).
2. En [Firebase Console](https://console.firebase.google.com/) → proyecto **jsagency** → Firestore → crea la base de datos.
3. Despliega las reglas de `firestore.rules` (Firestore → Reglas → publicar).  
   **Importante:** Las reglas actuales permiten lectura/escritura sin autenticación, adecuado solo para uso personal controlado.

## Estructura

```
/index.html
/css/style.css
/js/
  firebase.js
  app.js
  dashboard.js
  clientes.js
  sistemas.js
  ingresos.js
  estadisticas.js
  calendario.js
  configuracion.js
```

## Colecciones Firestore

| Colección       | Uso                          |
|----------------|------------------------------|
| `clientes`     | Datos de clientes            |
| `sistemas`     | Sistemas vendidos            |
| `ingresos`     | Pagos registrados            |
| `configuracion`| Doc `general` con ajustes    |

## Uso

Abre `index.html` desde un servidor HTTP (no `file://` directo, por restricciones de Firebase en algunos navegadores).
