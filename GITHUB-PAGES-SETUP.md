# 📱 Hospedar Mi Triatlón en GitHub Pages

## Archivos que vas a subir al repo

Crea un nuevo repo o usa uno existente (ej: `triatlon-app`). En la raíz sube **solo estos 5 archivos**:

```
triatlon-app/
├── index.html       ← App del atleta (renombrado desde triatlon-atleta.html)
├── manifest.json    ← Configuración PWA
├── sw.js            ← Service worker (offline)
├── icon-192.png     ← Icono pequeño
└── icon-512.png     ← Icono grande
```

> ⚠️ **Importante**: El archivo de la app DEBE llamarse `index.html`. Ya te lo he renombrado.

---

## Pasos paso a paso

### 1. Crea el repo
- Ve a https://github.com/new
- Nombre: `triatlon-atleta` (o el que quieras)
- Público (necesario para GitHub Pages gratis)
- Crear

### 2. Sube los 5 archivos
- En el repo nuevo → **Add file** → **Upload files**
- Arrastra los 5 archivos: `index.html`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`
- Commit changes

### 3. Activa GitHub Pages
- En el repo → **Settings** → **Pages** (menú lateral izquierdo)
- En "Source" elige: **Deploy from a branch**
- Branch: **main** · folder: **/(root)** · **Save**
- Espera 1-2 min

### 4. Obtén la URL
Aparecerá una URL del tipo:
```
https://[tu-usuario].github.io/triatlon-atleta/
```

Pásasela a Nacho.

---

## Cómo Nacho instala la app en su iPhone

1. Abrir Safari (no Chrome) y entrar a la URL
2. Iniciar sesión (email + contraseña)
3. Pulsar el botón **Compartir** (cuadrado con flecha hacia arriba)
4. Bajar y pulsar **"Añadir a pantalla de inicio"**
5. Pulsar **Añadir**

Ahora tiene el icono del tridente en su pantalla. Al pulsarlo se abre como app nativa (sin barra del navegador, modo standalone).

---

## Cómo Nacho instala la app en su Android

1. Abrir Chrome y entrar a la URL
2. Iniciar sesión
3. Aparecerá un banner "Instalar Mi Triatlón" — pulsar
4. Si no aparece: menú ⋮ → **"Instalar app"** o **"Añadir a pantalla de inicio"**

---

## Cuando hagas cambios

Cualquier vez que actualices `index.html`:
1. Sube el nuevo archivo al repo (sustituye al viejo)
2. **MUY IMPORTANTE**: edita `sw.js` y cambia la versión:
   ```js
   const CACHE_VERSION = 'mi-triatlon-v2';   // sube el número
   ```
   Esto fuerza al navegador a tirar el caché viejo. Sin este paso, Nacho verá la versión vieja durante horas.
3. Sube `sw.js` también al repo

Cuando Nacho abra la app, en background bajará la nueva versión y al cierre/apertura siguiente verá los cambios.

---

## Cómo Nacho fuerza la actualización (si no le llega solo)

En Safari o Chrome móvil:
1. Cierra completamente la app (deslízala hacia arriba en multitarea)
2. Vuelve a abrirla
3. Si tarda en actualizar: borrar caché de Safari/Chrome para ese sitio

O directamente: pulsar **Salir** en la app y volver a entrar.
