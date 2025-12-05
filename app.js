// app.js — Bingo de Envidiosos mejorado

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  get,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Configuración Firebase (igual que antes)
const firebaseConfig = {
  apiKey: "AIzaSyBNA7SSd5BBNxJX3WcWmWf1BpfAwSYJ2j8",
  authDomain: "bingo-de-envidiosos.firebaseapp.com",
  databaseURL: "https://bingo-de-envidiosos-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bingo-de-envidiosos",
  storageBucket: "bingo-de-envidiosos.appspot.com",
  messagingSenderId: "435635810146",
  appId: "1:435635810146:web:f8a1d6cec9f339874b863b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ─────────────────────────────────────────────
// Configuración de colores permitidos (en español)
// ─────────────────────────────────────────────
const allowedColors = {
  rojo:     "#e74c3c",
  azul:     "#3498db",
  verde:    "#2ecc71",
  amarillo: "#ffd800", // más intenso y brillante
  naranja:  "#e67e22",
  rosa:     "#ff6bba",
  morado:   "#9b59b6",
  cian:     "#1abc9c",
  lima:     "#b6ff3b",
  marron:   "#8e5b3b",
  turquesa: "#40e0d0",
  gris:     "#7f8c8d",
  dorado:   "#b8860b", // más oscuro, rollo ocre
  // plata fuera, lo cambiamos por un color nuevo:
  coral:    "#ff7f50",
  indigo:   "#3f51b5"
};

// 15 colores, sin blanco/negro

// ─────────────────────────────────────────────
// Estado local
// ─────────────────────────────────────────────
let myUserId = null;
let myName = null;
let myColorKey = null;
let myColorHex = null;

// Estado de las tablas (última versión conocida)
let globalState = {};
let personalState = {};
let personalKeysOrder = []; // orden real de las casillas del bingo personal

// Historias para deshacer (solo de este dispositivo/usuario)
let globalHistory = JSON.parse(localStorage.getItem("globalHistory") || "[]");
let personalHistory = JSON.parse(localStorage.getItem("personalHistory") || "[]");

// Referencias a nodos
const globalRef = ref(db, "bingo");
const usersRef = ref(db, "users");
const colorsRef = ref(db, "colors");

// Elementos DOM
const bingoGlobalDiv = document.getElementById("bingo-global");
const bingoPersonalDiv = document.getElementById("bingo-personal");
const undoGlobalBtn = document.getElementById("undoGlobal");
const undoPersonalBtn = document.getElementById("undoPersonal");
const resetGlobalBtn = document.getElementById("resetGlobal");
const logoutBtn = document.getElementById("logoutBtn");
const userInfoSpan = document.getElementById("userInfo");
const scoreLabel = document.getElementById("scoreLabel");
const winnerMsg = document.getElementById("winnerMsg");


// ─────────────────────────────────────────────
// Inicio
// ─────────────────────────────────────────────
init();

async function init() {
  await initUserSession();      // nombre + color
  setupListeners();             // escuchar cambios de bingos
  setupButtons();               // deshacer / logout / limpiar
}

// ─────────────────────────────────────────────
// Gestión de usuario (nombre + color + sesión)
// ─────────────────────────────────────────────
async function initUserSession() {
  const storedId = localStorage.getItem("bingoUserId");
  if (storedId) {
    const snap = await get(ref(db, `users/${storedId}`));
    if (snap.exists()) {
      const u = snap.val();
      myUserId = storedId;
      myName = u.name;
      myColorKey = u.colorKey;
      myColorHex = u.colorHex;
      updateUserUI();
      return;
    } else {
      localStorage.removeItem("bingoUserId");
    }
  }

  // 1) pedir nombre
  let name = null;
  while (!name) {
    name = prompt("Introduce tu nombre:")?.trim();
    if (!name) alert("El nombre no puede estar vacío.");
  }

  // 2) elegir color
  const { colorKey, colorHex } = await askForColor(name);

  // 3) crear usuario
  const userId = "user_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  myUserId = userId;
  myName = name;
  myColorKey = colorKey;
  myColorHex = colorHex;

  // guardar en DB
  await set(ref(db, `users/${userId}`), {
    name,
    colorKey,
    colorHex
  });

  await set(ref(db, `colors/${colorKey}`), {
    userId,
    userName: name
  });

  // crear bingo personal copiando estructura del global
  const globalSnap = await get(globalRef);
  const globalData = globalSnap.val() || {};
  const personalInit = {};
  for (const key in globalData) {
    personalInit[key] = {
      text: globalData[key].text,
      marked: false
    };
  }
  await set(ref(db, `personalBingos/${userId}`), personalInit);

  localStorage.setItem("bingoUserId", userId);
  updateUserUI();
}

async function askForColor(userName) {
  const colorsSnap = await get(colorsRef);
  const usedColors = colorsSnap.val() || {};

  while (true) {
    // construir listado
    let msg = `Hola ${userName}. Estos son los colores disponibles (si ves un nombre entre paréntesis, ese color ya está cogido):\n\n`;
    Object.keys(allowedColors).forEach((key) => {
      const used = usedColors[key];
      if (used && used.userName) {
        msg += `- ${key} (${used.userName})\n`;
      } else {
        msg += `- ${key}\n`;
      }
    });
    msg += `\nEscribe uno de los colores de la lista (en minúsculas, sin acentos):`;

    let chosen = prompt(msg);
    if (!chosen) continue;
    chosen = chosen.trim().toLowerCase();

    // validar
    if (!allowedColors[chosen]) {
      alert("Ese color no es válido o no está en la lista. Inténtalo de nuevo.");
      continue;
    }
    if (usedColors[chosen]) {
      alert(`Ese color ya lo ha elegido ${usedColors[chosen].userName}. Elige otro.`);
      continue;
    }
    // (por si acaso) bloquear nombres blanco/negro
    if (chosen === "blanco" || chosen === "negro") {
      alert("No puedes usar blanco o negro. Elige otro color.");
      continue;
    }

    return { colorKey: chosen, colorHex: allowedColors[chosen] };
  }
}

function updateUserUI() {
  userInfoSpan.textContent = `Conectado como ${myName} (${myColorKey})`;
  logoutBtn.style.display = "inline-block";
  // botón limpiar solo para Sebi
  if (myName === "Sebi") {
    resetGlobalBtn.style.display = "inline-block";
  }
}

// ─────────────────────────────────────────────
// Listeners de Firebase para los dos bingos
// ─────────────────────────────────────────────
function setupListeners() {
  // bingo general
  onValue(globalRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    globalState = data;
    renderGlobalBingo();
    computeAndRenderScore();   // <- esto
  });

  const personalRef = ref(db, `personalBingos/${myUserId}`);
  onValue(personalRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    personalState = data;
    renderPersonalBingo();
    computeAndRenderScore();   // <- y esto
  });
}

// ─────────────────────────────────────────────
// Render de bingos
// ─────────────────────────────────────────────
function renderGlobalBingo() {
  bingoGlobalDiv.innerHTML = "";

  const keys = Object.keys(globalState || {}).sort((a, b) => {
    const na = parseInt(a.split("_")[1], 10);
    const nb = parseInt(b.split("_")[1], 10);
    return na - nb;
  });

  keys.forEach(casilla => {
    const cellData = globalState[casilla];
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.textContent = cellData.text || casilla;

    if (cellData.colorHex) {
      cell.style.backgroundColor = cellData.colorHex;
      cell.style.color = "#000"; // texto negro siempre
    }

    cell.onclick = () => handleGlobalClick(casilla);
    bingoGlobalDiv.appendChild(cell);
  });
}


function renderPersonalBingo() {
  bingoPersonalDiv.innerHTML = "";
  personalKeysOrder = [];

  // ordenar casillas por número
  const keys = Object.keys(personalState || {}).sort((a, b) => {
    const na = parseInt(a.split("_")[1], 10);
    const nb = parseInt(b.split("_")[1], 10);
    return na - nb;
  });

  keys.forEach(casilla => {
    const cellData = personalState[casilla];
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.textContent = cellData.text || casilla;

    if (cellData.marked) {
      cell.style.backgroundColor = myColorHex;
      cell.style.color = "#000";
    }

    cell.onclick = () => handlePersonalClick(casilla);

    // guardamos el orden EXACTO en el que se pinta
    personalKeysOrder.push(casilla);
    bingoPersonalDiv.appendChild(cell);
  });
}


function computeAndRenderScore() {
  if (!myUserId) return;

  // usar exactamente el mismo orden con el que se pintó el bingo
  const keys = personalKeysOrder;
  if (!keys || keys.length !== 25) {
    if (scoreLabel) scoreLabel.textContent = `Envidia: 0`;
    if (winnerMsg) winnerMsg.textContent = "";
    return;
  }

  const markedPersonal = keys.map(key => {
    const cell = personalState[key];
    return !!(cell && cell.marked);
  });

  const personalMarkedCount = markedPersonal.filter(Boolean).length;

  // 2) si por lo que sea no hay 25 casillas, salimos para evitar cosas raras
  if (markedPersonal.length !== 25) {
    if (scoreLabel) scoreLabel.textContent = `Envidia: 0`;
    if (winnerMsg) winnerMsg.textContent = "";
    return;
  }

  // 3) líneas (mismo índice que antes)
  const lines = [
    [0,1,2,3,4],
    [5,6,7,8,9],
    [10,11,12,13,14],
    [15,16,17,18,19],
    [20,21,22,23,24],
    [0,5,10,15,20],
    [1,6,11,16,21],
    [2,7,12,17,22],
    [3,8,13,18,23],
    [4,9,14,19,24],
    [0,6,12,18,24],
    [4,8,12,16,20]
  ];

  let completedLines = 0;
  for (const line of lines) {
    const full = line.every(idx => markedPersonal[idx]);
    if (full) completedLines++;
  }

  const fullBoard = personalMarkedCount === 25;

  // 4) casillas globales del usuario
  let globalMarkedByMe = 0;
  for (const casilla in globalState) {
    const cell = globalState[casilla];
    if (cell && cell.markedByUserId === myUserId) {
      globalMarkedByMe++;
    }
  }

  // 5) puntuación personal
  let personalScore = personalMarkedCount + (completedLines * 5);
  if (fullBoard) {
    personalScore += 50;
  }

  const totalScore = personalScore + globalMarkedByMe;

  // 6) pintar puntos
  if (scoreLabel) {
    scoreLabel.textContent = `Envidia: ${totalScore}`;
  }

  // 7) mensaje ganador
  if (winnerMsg) {
    if (fullBoard) {
      winnerMsg.textContent = "FELICIDADES ERES EL MAS ENVIDIOSO";
    } else {
      winnerMsg.textContent = "";
    }
  }
}




// ─────────────────────────────────────────────
// Clicks y deshacer
// ─────────────────────────────────────────────
async function handleGlobalClick(casilla) {
  if (!myUserId) return;
  const prev = globalState[casilla] || {};

  // si ya está marcada por alguien, no se puede cambiar
  if (prev.colorHex) {
    return;
  }

  const newState = {
    ...prev,
    markedByUserId: myUserId,
    colorKey: myColorKey,
    colorHex: myColorHex
  };

  globalHistory.push({ casilla, prev });
  localStorage.setItem("globalHistory", JSON.stringify(globalHistory));
  await set(ref(db, `bingo/${casilla}`), newState);
}

async function handlePersonalClick(casilla) {
  if (!myUserId) return;
  const prev = personalState[casilla] || {};
  const newState = {
    ...prev,
    marked: !prev.marked // toggle
  };
  personalHistory.push({ casilla, prev });
  localStorage.setItem("personalHistory", JSON.stringify(personalHistory));
  await set(ref(db, `personalBingos/${myUserId}/${casilla}`), newState);
}

function setupButtons() {
  undoGlobalBtn.onclick = async () => {
    if (!myUserId) return;
    const last = globalHistory.pop();
    if (!last) return;
    await set(ref(db, `bingo/${last.casilla}`), last.prev);
    localStorage.setItem("globalHistory", JSON.stringify(globalHistory));
  };

  undoPersonalBtn.onclick = async () => {
    if (!myUserId) return;
    const last = personalHistory.pop();
    if (!last) return;
    await set(ref(db, `personalBingos/${myUserId}/${last.casilla}`), last.prev);
    localStorage.setItem("personalHistory", JSON.stringify(personalHistory));
  };

  logoutBtn.onclick = () => {
    if (!myUserId) return;
    const sure = confirm("¿Seguro que quieres cerrar sesión y liberar tu color?");
    if (!sure) return;
    logoutCurrentUser();
  };

  resetGlobalBtn.onclick = () => {
    if (myName !== "Sebi") return;
    const sure = confirm("¿Limpiar todo el bingo general?");
    if (!sure) return;
    resetGlobalBingo();
  };
}

// ─────────────────────────────────────────────
// Cerrar sesión: borrar usuario, color y marcas
// ─────────────────────────────────────────────
async function logoutCurrentUser() {
  const userSnap = await get(ref(db, `users/${myUserId}`));
  if (!userSnap.exists()) {
    localStorage.removeItem("bingoUserId");
    location.reload();
    return;
  }
  const u = userSnap.val();
  const colorKey = u.colorKey;

  // quitar marcas del bingo general hechas por este usuario
  const globalSnap = await get(globalRef);
  const globalData = globalSnap.val() || {};
  const updates = {};
  for (const casilla in globalData) {
    const cell = globalData[casilla];
    if (cell.markedByUserId === myUserId) {
      updates[`bingo/${casilla}/markedByUserId`] = null;
      updates[`bingo/${casilla}/colorKey`] = null;
      updates[`bingo/${casilla}/colorHex`] = null;
    }
  }

  // borrar bingo personal entero
  updates[`personalBingos/${myUserId}`] = null;

  // liberar color
  updates[`colors/${colorKey}`] = null;

  // borrar usuario
  updates[`users/${myUserId}`] = null;

  await update(ref(db), updates);

  globalHistory = [];
  personalHistory = [];
  localStorage.removeItem("globalHistory");
  localStorage.removeItem("personalHistory");

  localStorage.removeItem("bingoUserId");
  location.reload();
}

// ─────────────────────────────────────────────
// Limpiar bingo general (solo Sebi)
// ─────────────────────────────────────────────
async function resetGlobalBingo() {
  const globalSnap = await get(globalRef);
  const globalData = globalSnap.val() || {};
  const updates = {};
  for (const casilla in globalData) {
    updates[`bingo/${casilla}/markedByUserId`] = null;
    updates[`bingo/${casilla}/colorKey`] = null;
    updates[`bingo/${casilla}/colorHex`] = null;
  }
  await update(ref(db), updates);
  globalHistory = []; // tu historial local se limpia
  localStorage.setItem("globalHistory", "[]");
}
