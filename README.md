# ⚽ Tiro Libre Cinemático: Física del Balón (3D)

Simulador interactivo y juego de física cinemática en 3D ambientado desde la perspectiva en primera persona de un futbolista antes de ejecutar un tiro libre.

## 📐 Las 4 Fórmulas de Proyectiles Integradas
El juego utiliza las ecuaciones fundamentales del tiro de proyectiles con \(g = 10\text{ m/s}^2\) (por lo que \(\frac{1}{2}g = 5\)):

1. **Velocidad Horizontal Final**:
   \[
   V_{fx} = v_i \cdot \cos(\alpha)
   \]
2. **Posición Horizontal en función del tiempo**:
   \[
   X_f = X_i + v_i \cdot \cos(\alpha) \cdot t
   \]
3. **Velocidad Vertical Final**:
   \[
   V_{fy} = v_i \cdot \sin(\alpha) - g \cdot t
   \]
4. **Posición Vertical en función del tiempo**:
   \[
   Y_f = Y_i + v_i \cdot \sin(\alpha) \cdot t - 5t^2
   \]

---

## 🎮 Los 4 Apartados / Modos de Juego

1. **🎯 Al Ángulo (Tiro Oblicuo)**:
   - Apunta a la escuadra superior del arco (\(Y_f \approx 2.20\text{ m}\)).
   - Resuelve la velocidad inicial \(v_i\) o el tiempo \(t\) necesario para que la parábola termine en el ángulo imposible para el arquero.

2. **⚡ Por Abajo (Tiro Horizontal / Rasante)**:
   - Disparo con mínima elevación (\(\alpha \approx 2^\circ - 3^\circ\)).
   - Analiza el movimiento rectilíneo casi horizontal y calcula la velocidad \(V_{fx}\) o el tiempo de llegada al ras del césped.

3. **🛡️ Barrera por Arriba (Superar la Barrera)**:
   - La barrera defensiva se ubica a \(9.15\text{ m}\) reglamentarios (altura parada: \(1.85\text{ m}\); si saltan: \(2.40\text{ m}\)).
   - Calcula si la altura del balón \(Y(X_{barrera})\) supera las cabezas de los defensores y baja a tiempo antes del travesaño.
   - **Salto aleatorio**: La barrera salta o se queda parada de forma aleatoria (configurable en el menú de opciones).

4. **🪄 Barrera por Abajo (Pasar por debajo al saltar)**:
   - Emula el clásico gol de Ronaldinho o Messi cuando la barrera salta.
   - Al saltar, se abre un hueco inferior de \(0.55\text{ m}\) bajo sus botines.
   - Si la barrera salta y el balón pasa a \(Y < 0.55\text{ m}\), ¡es un golazo por debajo!
   - Si la barrera no salta, el balón rebota en las piernas de los defensores.

---

## ⚙️ Modificación de la Distancia al Arco
- Selector deslizable de **16 m a 35 m** con botones predefinidos (18 m, 22 m, 26 m, 32 m).
- Al variar la distancia, el arco reglamentario, las líneas de área y las gradas se reubican dinámicamente en 3D.

---

## 🎥 Cámaras Disponibles
- **👤 Vista Jugador (1ra Persona)**: Situado justo detrás del balón sobre el césped, con visión hacia la barrera y la portería.
- **🚀 Cámara de Seguimiento**: Persigue el vuelo del balón en tiempo real.
- **📐 Gráfico X-Y**: Perfil cinemático lateral cartesiano para apreciar la parábola y los vectores de velocidad.
- **🥅 Desde el Arco**: Vista inversa detrás de la red mirando al ejecutante.

---

## 🚀 Cómo Ejecutar
Abre directamente el archivo `index.html` en cualquier navegador web moderno (Chrome, Edge, Firefox, Safari) haciendo doble clic sobre él o ejecutando un servidor local:
```bash
python -m http.server 8000
```
Y accede a `http://localhost:8000` en tu navegador.
