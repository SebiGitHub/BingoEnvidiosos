## ¿Qué es este proyecto?

Este proyecto es un **bingo colaborativo online** hecho con:

- **HTML + CSS + JavaScript (ES Modules)**  
- **Firebase Realtime Database** como backend en tiempo real  
- Un diseño pensado para móvil, con estética de anime y texto llamativo.

La idea es que tú y tus amigos tengáis:

1. Un **bingo general compartido** donde el primero que cumple cada reto se queda esa casilla con su color.
2. Un **bingo personal** que solo puede marcar cada jugador, para llevar su propio progreso.

Todo se sincroniza en vivo entre móviles y ordenadores usando Firebase.

---

## ¿Cómo funciona?

### 1. Flujo de entrada: nombre y color

Cuando alguien entra en la web:

1. La app le pide que introduzca su **nombre**.
2. Después, le muestra una lista de **colores disponibles** (en español: `rojo`, `azul`, `verde`, etc.).
3. Cada color:
   - Se muestra libre (solo el nombre del color) o
   - Marcado como ocupado con el nombre de quien lo usa, por ejemplo: `rojo (Sebastián)`.
4. El usuario escribe el nombre de un color de la lista:
   - Si el color no existe → error.
   - Si ya está cogido → error.
   - Si intenta “blanco” o “negro” → no permitido.
5. Si todo es correcto:
   - Se guarda su **usuario** en Firebase con `name`, `colorKey` y `colorHex`.
   - Se registra ese color como utilizado en el nodo `colors`.
   - Se crea un **bingo personal** para ese usuario copiando la estructura del bingo general.

Además, el navegador guarda su `bingoUserId` en `localStorage`, así que si vuelve a entrar desde el mismo dispositivo:
- No le vuelve a pedir nombre ni color;
- Recupera su sesión automáticamente.

Arriba a la derecha se muestra algo tipo:

> `Conectado como Sebi (rojo)`

y un botón de **Cerrar sesión**.

---

### 2. Bingo general (compartido)

El nodo `bingo` en Firebase contiene las 25 casillas (5x5), cada una con un texto de reto.

En la interfaz:

- El **bingo general** se muestra arriba.
- Cada casilla:
  - Muestra el texto del reto.
  - Si está libre, tiene fondo blanco.
  - Si ya ha sido reclamada, se pinta con el color de la persona que la marcó.

Lógica de marcado:

- Al pulsar una casilla libre en el bingo general:
  - Se guarda en Firebase quién la ha marcado (`markedByUserId`, `colorKey`, `colorHex`).
  - La casilla se colorea para todos los jugadores en tiempo real.
- Si una casilla ya está marcada por alguien:
  - Otro usuario **no puede cambiarla** ni sobreescribirla.
  - Así, el primero que completa ese reto se lo queda.

También existe un botón de **Deshacer (bingo general)** que solo afecta al historial local del usuario (para revertir sus propias acciones en ese dispositivo) y un botón oculto de **Limpiar bingo** que solo aparece si el nombre es `Sebi`.  
El botón de limpiar:

- Deja todas las casillas del bingo general sin color y sin dueño.
- Es útil para reiniciar la partida o hacer pruebas.

---

### 3. Bingo personal (individual por usuario)

Para cada usuario se crea un nodo `personalBingos/<userId>` con sus 25 casillas personales.

En la interfaz:

- Debajo del bingo general se muestra el **“Tu bingo personal”**.
- Es visualmente igual (5x5, mismos textos), pero:
  - Solo el propietario puede marcar o desmarcar sus casillas.
  - Los cambios no afectan al bingo personal de los demás.

Al pulsar una casilla en el bingo personal:

- Se hace un **toggle**:
  - Si estaba sin marcar → se marca.
  - Si estaba marcada → se desmarca.
- Se guarda en Firebase (`marked: true/false`) y se refleja en la UI.
- También se registra la acción en un historial local (`personalHistory`) para poder usar el botón **Deshacer (bingo personal)**.

---

### 4. Sistema de puntuación (“Envidia”)

El marcador de **“Envidia: X”** mide los puntos del usuario actual combinando:

1. Su **bingo personal**
2. Su contribución al **bingo general**

La lógica es:

#### En el bingo personal

- **+1 punto por cada casilla marcada**.
- **+5 puntos por cada línea completa**:
  - Filas horizontales,
  - Columnas verticales,
  - Las dos diagonales.
- **+50 puntos extra si completa todo el bingo personal** (las 25 casillas).

Para que el cálculo sea correcto, el código:

- Ordena siempre las casillas por número (`casilla_1`…`casilla_25`),
- Construye un array de 25 booleanos (`true/false`),
- Comprueba todas las combinaciones de líneas posibles,
- Cuenta cuántas están completamente marcadas.

#### Bingo general (retos compartidos)

- Por cada casilla del bingo general marcada por el usuario (es decir, donde `markedByUserId == su userId`), se suma **+1 punto adicional**.

#### Total

El marcador final muestra:

> `Envidia = (puntos del bingo personal) + (retos ganados en el bingo general)`

El mensaje:

- Muestra además un texto especial cuando el usuario completa su bingo personal:
  - `"FELICIDADES ERES EL MAS ENVIDIOSO"`

Cualquier pulsación de **Deshacer** hace que:

- Se revierte la última acción del usuario (global o personal, según el botón).
- El marcador se recalcula de nuevo con el estado actual (así los puntos suben o bajan correctamente).

---

### 5. Gestión de sesión y cierre

El botón **Cerrar sesión**:

- Borra el usuario de Firebase (`users/<userId>`).
- Libera su color en `colors`.
- Borra su bingo personal (`personalBingos/<userId>`).
- Limpia sus marcas en el bingo general (las casillas que había reclamado).
- Limpia los historiales de deshacer y el `localStorage`.
- Recarga la página para volver a la pantalla de nombre+color.

Esto permite que:

- Alguien que se haya equivocado con el nombre o color pueda “empezar de cero”.
- Su antiguo color vuelva a estar disponible para otros.

---

### 6. Tecnologías usadas

- **Frontend**
  - HTML5
  - CSS (grid + responsive design)
  - JavaScript (ES Modules)

- **Backend / tiempo real**
  - Firebase Realtime Database
  - Firebase Hosting

- **Extras**
  - Tipografía personalizada tipo anime para el título y marcador.
  - Estética con fondo de imagen y colores llamativos (rosa chicle, amarillo brillante, etc.).

---

## ¿Para qué sirve?

Este proyecto está pensado para:

- **Eventos frikis / convenciones** (tipo Mangafest, salones del manga, etc.).
- **Quedadas de amigos** donde queráis:
  - tener retos visuales,
  - picaros sanamente,
  - y ver quién “farmea” más envidia.

Al final, **Bingo de Envidiosos** es una excusa para:

- Observar lo que pasa alrededor,
- Buscar cosas absurdas/divertidas,
- Competir y cooperar a la vez,
- Y tener un registro en tiempo real de quién ha hecho qué.

Se puede adaptar fácilmente cambiando:

- Los textos de las casillas en `marcado.json` / Realtime Database.
- Los colores disponibles.
- La temática (no solo “envidia”; podría ser miedo, locura, cringe, etc.).

Es una base reutilizable para cualquier **bingo social gamificado** que quieras montar con tus colegas.
