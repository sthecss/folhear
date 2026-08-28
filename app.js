import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// Estado geral da aplicação
const state = {
  pdf: null,
  file: null,
  position: 0,
  positions: [],
  binding: "brochure",
  paper: 75,
  cover: "soft",
  spiral: "black",
  zoom: 1,
  renderToken: 0,
  orientation: "portrait",
  size: "original",
  animating: false,
  view: "pages",
  objectX: -12,
  objectY: -28,
  objectPosition: 0,
  objectAnimating: false,
};
const elements = {
  input: $("#fileInput"),
  upload: $("#uploadBox"),
  fileCard: $("#fileCard"),
  fileName: $("#fileName"),
  fileMeta: $("#fileMeta"),
  empty: $("#emptyState"),
  loading: $("#loadingState"),
  loadingText: $("#loadingText"),
  stage: $("#bookStage"),
  book: $("#book"),
  objectStage: $("#objectStage"),
  objectBook: $("#objectBook"),
  objectFront: $("#objectFront"),
  objectBack: $("#objectBack"),
  left: $("#leftPage"),
  right: $("#rightPage"),
  turn: $("#turnPage"),
  prev: $("#prevPage"),
  next: $("#nextPage"),
  indicator: $("#pageIndicator"),
  sheets: $("#sheetInfo"),
  progress: $("#progressBar"),
  status: $("#statusChip"),
  title: $("#viewTitle"),
  subtitle: $("#viewSubtitle"),
  spiralColors: $("#spiralColors"),
  toast: $("#toast"),
};

// Funções auxiliares
function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => elements.toast.classList.remove("show"), 2800);
}
function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function buildPositions(count) {
  const items = [{ type: "cover", left: null, right: 1 }];
  for (let page = 2; page < count; page += 2)
    items.push({
      type: "spread",
      left: page,
      right: page + 1 < count ? page + 1 : null,
    });
  if (count > 1) items.push({ type: "back", left: null, right: count });
  return items;
}

function getPositionLabel(position) {
  if (position.type === "cover") return "Capa";
  if (position.type === "back") return "Contracapa";

  const lastPage = position.right ? `–${position.right}` : "";
  return `Páginas ${position.left}${lastPage}`;
}

function getProgress(currentPosition) {
  if (state.positions.length <= 1) return 100;
  return (currentPosition / (state.positions.length - 1)) * 100;
}

function brochureIsValid() {
  return !state.pdf || state.pdf.numPages % 4 === 0;
}
function updateJumpButtons(
  position = state.view === "object" ? state.objectPosition : state.position,
) {
  $$("[data-jump]").forEach((button) =>
    button.classList.toggle(
      "active",
      button.dataset.jump ===
        (position === state.positions.length - 1 ? "end" : "start") &&
        (position === 0 || position === state.positions.length - 1),
    ),
  );
}
function thicknessMm() {
  const perSheet = { 75: 0.095, 90: 0.115, 120: 0.15, 150: 0.185 }[state.paper];
  return (
    Math.ceil((state.pdf?.numPages || 0) / 2) * perSheet +
    (state.cover === "hard" ? 3 : 0.5)
  );
}

// Carregamento e leitura do PDF
async function loadFile(file) {
  if (!file) return;
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  )
    return toast("Escolha um arquivo PDF válido.");
  elements.empty.hidden = true;
  elements.stage.hidden = true;
  elements.loading.hidden = false;
  elements.loadingText.textContent = "Lendo o PDF localmente";
  try {
    const bytes = await file.arrayBuffer();
    const task = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
    state.pdf = await task.promise;
    state.file = file;
    state.position = 0;
    state.objectPosition = 0;
    state.positions = buildPositions(state.pdf.numPages);
    if (!brochureIsValid() && state.binding === "brochure") {
      state.binding = "spiral";
      updateBinding("spiral");
      toast(
        `Brochura exige múltiplos de 4 páginas. Este PDF tem ${state.pdf.numPages}; modo espiral selecionado.`,
      );
    }
    elements.upload.hidden = true;
    elements.fileCard.hidden = false;
    elements.fileName.textContent = file.name;
    elements.fileMeta.textContent = `${state.pdf.numPages} página${state.pdf.numPages === 1 ? "" : "s"} · ${formatBytes(file.size)}`;
    elements.status.textContent = "PDF LOCAL";
    elements.title.textContent = file.name;
    elements.subtitle.textContent = "Processado apenas neste dispositivo";
    elements.loading.hidden = true;
    if (state.view === "object") {
      elements.stage.hidden = true;
      elements.objectStage.hidden = false;
      await renderObject();
    } else {
      elements.objectStage.hidden = true;
      elements.stage.hidden = false;
      await renderPosition();
    }
  } catch (error) {
    console.error(error);
    state.pdf = null;
    elements.loading.hidden = true;
    elements.empty.hidden = false;
    elements.upload.hidden = false;
    elements.fileCard.hidden = true;
    toast(
      error?.name === "PasswordException"
        ? "PDF protegido por senha não suportado."
        : "Não foi possível abrir este PDF.",
    );
  }
}

async function renderPage(pageNumber, pageElement, token) {
  const canvas = pageElement.querySelector("canvas");
  const number = pageElement.querySelector(".page-number");
  if (!pageNumber) {
    pageElement.classList.add("blank");
    canvas.width = 1;
    canvas.height = 1;
    number.textContent = "";
    return;
  }
  pageElement.classList.remove("blank");
  number.textContent = pageNumber;
  const page = await state.pdf.getPage(pageNumber);
  if (token !== state.renderToken) return;
  const base = page.getViewport({ scale: 1 });
  const maxDimension = 1100;
  const scale = Math.min(2.2, maxDimension / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({
    canvasContext: canvas.getContext("2d", { alpha: false }),
    viewport,
  }).promise;
}

// Visualização para folhear
async function renderPosition() {
  if (!state.pdf) return;
  const token = ++state.renderToken;
  const current = state.positions[state.position];
  elements.book.classList.toggle("closed", current.type !== "spread");
  elements.book.classList.toggle("back", current.type === "back");
  await Promise.all([
    renderPage(current.left, elements.left, token),
    renderPage(current.right, elements.right, token),
  ]);
  if (token !== state.renderToken) return;
  elements.indicator.textContent = getPositionLabel(current);
  elements.progress.style.width = `${getProgress(state.position)}%`;
  elements.sheets.textContent = `${Math.ceil(state.pdf.numPages / 2)} folhas · ${spineLabel()}`;
  elements.prev.disabled = state.position === 0;
  elements.next.disabled = state.position === state.positions.length - 1;
  updateJumpButtons(state.position);
  adaptBookRatio(current.right || current.left);
}

async function adaptBookRatio(pageNumber) {
  if (!pageNumber || state.size !== "original") {
    elements.book.style.removeProperty("--page-ratio");
    applyFormat();
    return;
  }
  try {
    const page = await state.pdf.getPage(pageNumber);
    const view = page.getViewport({ scale: 1 });
    const ratio = view.width / view.height;
    setBookRatio(
      state.orientation === "portrait"
        ? Math.min(ratio, 1 / ratio)
        : Math.max(ratio, 1 / ratio),
    );
  } catch (_) {}
}
function setBookRatio(ratio) {
  const stage = elements.stage.getBoundingClientRect();
  const maxH = Math.min(stage.height * 0.8, 620);
  const pages = elements.book.classList.contains("closed") ? 1 : 2;
  let pageH = maxH,
    pageW = pageH * ratio;
  const maxW = (stage.width - 130) / pages;
  if (pageW > maxW) {
    pageW = maxW;
    pageH = pageW / ratio;
  }
  elements.book.style.width = `${pageW * pages}px`;
  elements.book.style.height = `${pageH}px`;
}
function applyFormat() {
  let ratio;
  if (state.size === "a4") ratio = 210 / 297;
  else if (state.size === "a5") ratio = 148 / 210;
  else return;
  if (state.orientation === "landscape") ratio = 1 / ratio;
  setBookRatio(ratio);
}
function spineLabel() {
  return `${thicknessMm().toFixed(1).replace(".", ",")} mm`;
}

// Visualização do objeto 3D
async function renderObjectCanvas(pageNumber, canvas) {
  const page = await state.pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, 1000 / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({
    canvasContext: canvas.getContext("2d", { alpha: false }),
    viewport,
  }).promise;
}
async function renderObjectSurface(
  canvas,
  current = state.positions[state.objectPosition],
) {
  if (current.type !== "spread")
    return renderObjectCanvas(current.right || current.left, canvas);
  const left = document.createElement("canvas"),
    right = document.createElement("canvas");
  await renderObjectCanvas(current.left, left);
  if (current.right) await renderObjectCanvas(current.right, right);
  const pageWidth = Math.max(left.width, right.width || left.width),
    height = Math.max(left.height, right.height || left.height);
  canvas.width = pageWidth * 2;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fffefa";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(left, 0, 0, pageWidth, height);
  if (current.right) context.drawImage(right, pageWidth, 0, pageWidth, height);
  const shade = context.createLinearGradient(
    pageWidth - 18,
    0,
    pageWidth + 18,
    0,
  );
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(0.48, "rgba(0,0,0,.2)");
  shade.addColorStop(0.52, "rgba(255,255,255,.35)");
  shade.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = shade;
  context.fillRect(pageWidth - 18, 0, 36, height);
}
async function objectRatio() {
  let pageRatio;
  if (state.size === "a4")
    pageRatio = state.orientation === "landscape" ? 297 / 210 : 210 / 297;
  else if (state.size === "a5")
    pageRatio = state.orientation === "landscape" ? 210 / 148 : 148 / 210;
  else {
    const page = await state.pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const ratio = viewport.width / viewport.height;
    pageRatio =
      state.orientation === "landscape"
        ? Math.max(ratio, 1 / ratio)
        : Math.min(ratio, 1 / ratio);
  }
  return state.positions[state.objectPosition]?.type === "spread"
    ? pageRatio * 2
    : pageRatio;
}
function updateObjectAppearance() {
  const book = elements.objectBook;
  book.classList.toggle("hard-3d", state.cover === "hard");
  book.classList.toggle("spiral-3d", state.binding === "spiral");
  book.classList.toggle(
    "object-open",
    state.positions[state.objectPosition]?.type === "spread",
  );
  book.classList.remove("wire-white-3d", "wire-metal-3d");
  if (state.spiral !== "black") book.classList.add(`wire-${state.spiral}-3d`);
  const sheets = Math.ceil((state.pdf?.numPages || 0) / 2);
  $("#thicknessValue").textContent = spineLabel();
  $("#thicknessFormula").textContent =
    `${sheets} folha${sheets === 1 ? "" : "s"} · papel ${state.paper} g/m²`;
}
function syncObjectCoils(height) {
  const coil = $("#objectCoil");
  const count = Math.max(8, Math.floor(height / 25));
  coil.replaceChildren();
  for (let index = 0; index < count; index++) {
    const ring = document.createElement("i");
    ring.style.top = `${((index + 0.5) / count) * 100}%`;
    coil.appendChild(ring);
  }
}
async function updateObjectGeometry() {
  if (!state.pdf) return;
  const ratio = await objectRatio();
  const box = elements.objectStage.getBoundingClientRect();
  const isSpread = state.positions[state.objectPosition]?.type === "spread";
  let height = Math.min(500, box.height * 0.7),
    width = height * ratio;
  const maxWidth = Math.min(
    isSpread ? 700 : 370,
    box.width * (isSpread ? 0.78 : 0.62),
  );
  if (width > maxWidth) {
    width = maxWidth;
    height = width / ratio;
  }
  // A profundidade é ampliada visualmente para que diferenças submilimétricas
  // continuem perceptíveis na tela, mantendo o valor numérico em escala real.
  const visualDepth = Math.max(6, Math.min(72, thicknessMm() * 12));
  elements.objectBook.style.setProperty("--object-w", `${width}px`);
  elements.objectBook.style.setProperty("--object-h", `${height}px`);
  elements.objectBook.style.setProperty("--object-d", `${visualDepth}px`);
  elements.objectBook.style.setProperty("--rx", `${state.objectX}deg`);
  elements.objectBook.style.setProperty("--ry", `${state.objectY}deg`);
  elements.objectBook.style.setProperty("--object-scale", state.zoom);
  syncObjectCoils(height);
  updateObjectAppearance();
}
async function renderObject() {
  if (!state.pdf) return;
  await Promise.all([
    renderObjectSurface(elements.objectFront),
    renderObjectCanvas(state.pdf.numPages, elements.objectBack),
  ]);
  $("#spineTitle").textContent = state.file.name.replace(/\.pdf$/i, "");
  await updateObjectGeometry();
  updateObjectNavigation();
}
function updateObjectNavigation() {
  const current = state.positions[state.objectPosition];
  $("#objectPrev").disabled = state.objectPosition === 0;
  $("#objectNext").disabled =
    state.objectPosition === state.positions.length - 1;
  elements.indicator.textContent = `3D · ${getPositionLabel(current)}`;
  elements.progress.style.width = `${getProgress(state.objectPosition)}%`;
  updateJumpButtons(state.objectPosition);
}
async function navigateObject(delta) {
  if (!state.pdf || state.objectAnimating) return;
  const target = Math.max(
    0,
    Math.min(state.positions.length - 1, state.objectPosition + delta),
  );
  if (target === state.objectPosition) return;
  state.objectAnimating = true;
  const currentPosition = state.positions[state.objectPosition],
    targetPosition = state.positions[target];
  const physicalSpread =
    state.binding === "spiral" &&
    currentPosition.type === "spread" &&
    targetPosition.type === "spread";
  const turn = $("#objectTurn"),
    sourceWidth = physicalSpread
      ? elements.objectFront.width / 2
      : elements.objectFront.width,
    sourceX = physicalSpread && delta > 0 ? sourceWidth : 0;
  turn.width = sourceWidth;
  turn.height = elements.objectFront.height;
  turn
    .getContext("2d")
    .drawImage(
      elements.objectFront,
      sourceX,
      0,
      sourceWidth,
      elements.objectFront.height,
      0,
      0,
      sourceWidth,
      elements.objectFront.height,
    );
  state.objectPosition = target;
  if (physicalSpread) {
    const interim = {
      type: "spread",
      left: delta > 0 ? currentPosition.left : targetPosition.left,
      right: delta > 0 ? targetPosition.right : currentPosition.right,
    };
    const backPage = delta > 0 ? targetPosition.left : targetPosition.right;
    await Promise.all([
      renderObjectSurface(elements.objectFront, interim),
      renderObjectCanvas(backPage, $("#objectTurnBack")),
    ]);
  } else
    await Promise.all([
      renderObjectSurface(elements.objectFront),
      renderObjectSurface($("#objectTurnBack")),
    ]);
  await updateObjectGeometry();
  updateObjectNavigation();
  elements.objectBook.classList.add(
    delta > 0 ? "object-next-turn" : "object-prev-turn",
  );
  setTimeout(async () => {
    if (physicalSpread) await renderObjectSurface(elements.objectFront);
    elements.objectBook.classList.remove(
      "object-next-turn",
      "object-prev-turn",
    );
    state.objectAnimating = false;
  }, 720);
}
async function setView(view) {
  if (view === "object" && !state.pdf) {
    toast("Carregue um PDF para visualizar o objeto 3D.");
    return;
  }
  state.view = view;
  $$("[data-view]").forEach((button) =>
    button.classList.toggle("active", button.dataset.view === view),
  );
  elements.stage.hidden = view !== "pages" || !state.pdf;
  elements.objectStage.hidden = view !== "object";
  if (view === "object") await renderObject();
  else if (state.pdf) await renderPosition();
}

// Navegação e passagem de páginas
async function navigate(delta) {
  if (!state.pdf) return;
  const target = Math.max(
    0,
    Math.min(state.positions.length - 1, state.position + delta),
  );
  if (target === state.position || state.animating) return;
  state.animating = true;
  const currentPosition = state.positions[state.position],
    targetPosition = state.positions[target];
  const physicalSpread =
    state.binding === "spiral" &&
    currentPosition.type === "spread" &&
    targetPosition.type === "spread";
  const source = delta > 0 ? elements.right : elements.left;
  const turnCanvas = elements.turn.querySelector("canvas");
  const sourceCanvas = source.querySelector("canvas");
  turnCanvas.width = sourceCanvas.width;
  turnCanvas.height = sourceCanvas.height;
  turnCanvas.getContext("2d").drawImage(sourceCanvas, 0, 0);
  const backCanvas = $("#turnBackCanvas");
  const backPage = physicalSpread
    ? delta > 0
      ? targetPosition.left
      : targetPosition.right
    : null;
  if (backPage) await renderObjectCanvas(backPage, backCanvas);
  else {
    backCanvas.width = 1;
    backCanvas.height = 1;
  }
  if (physicalSpread) {
    const token = ++state.renderToken;
    const interimLeft = delta > 0 ? currentPosition.left : targetPosition.left;
    const interimRight =
      delta > 0 ? targetPosition.right : currentPosition.right;
    await Promise.all([
      renderPage(interimLeft, elements.left, token),
      renderPage(interimRight, elements.right, token),
    ]);
    elements.book.classList.add(delta > 0 ? "turning-next" : "turning-prev");
    setTimeout(async () => {
      state.position = target;
      await renderPosition();
      elements.book.classList.remove("turning-next", "turning-prev");
      state.animating = false;
    }, 700);
    return;
  }
  // A página de destino fica pronta sob a folha animada. Assim, depois que a
  // folha cruza 90°, aparece o destino em vez do verso espelhado da origem.
  state.position = target;
  await renderPosition();
  elements.book.classList.add(delta > 0 ? "turning-next" : "turning-prev");
  setTimeout(() => {
    elements.book.classList.remove("turning-next", "turning-prev");
    state.animating = false;
  }, 700);
}

function updateBinding(value) {
  if (value === "brochure" && !brochureIsValid()) {
    toast(
      `Brochura exige múltiplos de 4 páginas. Este PDF tem ${state.pdf.numPages} páginas.`,
    );
    return;
  }
  state.binding = value;
  const isSpiral = value === "spiral";
  $$("[data-binding]").forEach((b) =>
    b.classList.toggle("active", b.dataset.binding === value),
  );
  elements.book.classList.remove("brochure", "spiral");
  elements.book.classList.add(isSpiral ? "spiral" : "brochure");
  $("#spiralWire").hidden = !isSpiral;
  elements.spiralColors.hidden = !isSpiral;
  elements.status.textContent = isSpiral ? "ESPIRAL" : "BROCHURA";
  if (state.pdf) elements.status.textContent += " · LOCAL";
  updateObjectAppearance();
  if (state.pdf) state.view === "object" ? renderObject() : renderPosition();
}
async function jumpToCover(where) {
  if (!state.pdf) return toast("Carregue um PDF primeiro.");
  const target = where === "end" ? state.positions.length - 1 : 0;
  if (state.view === "object") {
    state.objectPosition = target;
    await renderObject();
  } else {
    state.position = target;
    await renderPosition();
  }
}

// Eventos da interface
elements.input.addEventListener("change", (e) => loadFile(e.target.files[0]));
$("#changeFile").addEventListener("click", () => elements.input.click());
$("#emptyUpload").addEventListener("click", () => elements.input.click());
["dragenter", "dragover"].forEach((type) =>
  elements.upload.addEventListener(type, (e) => {
    e.preventDefault();
    elements.upload.classList.add("dragover");
  }),
);
["dragleave", "drop"].forEach((type) =>
  elements.upload.addEventListener(type, (e) => {
    e.preventDefault();
    elements.upload.classList.remove("dragover");
  }),
);
elements.upload.addEventListener("drop", (e) =>
  loadFile(e.dataTransfer.files[0]),
);
$$("[data-binding]").forEach((b) =>
  b.addEventListener("click", () => updateBinding(b.dataset.binding)),
);
$$("[data-jump]").forEach((button) =>
  button.addEventListener("click", () => jumpToCover(button.dataset.jump)),
);
$$("[data-paper]").forEach((b) =>
  b.addEventListener("click", () => {
    state.paper = Number(b.dataset.paper);
    $$("[data-paper]").forEach((x) => x.classList.toggle("active", x === b));
    updateObjectAppearance();
    if (state.pdf)
      state.view === "object" ? updateObjectGeometry() : renderPosition();
  }),
);
$$("[data-spiral]").forEach((b) =>
  b.addEventListener("click", () => {
    state.spiral = b.dataset.spiral;
    $$("[data-spiral]").forEach((x) => x.classList.toggle("active", x === b));
    elements.book.classList.remove("wire-white", "wire-metal");
    if (state.spiral !== "black")
      elements.book.classList.add(`wire-${state.spiral}`);
    updateObjectAppearance();
  }),
);
$("#sizeSelect").addEventListener("change", (e) => {
  state.size = e.target.value;
  if (state.pdf)
    state.view === "object"
      ? updateObjectGeometry()
      : adaptBookRatio(
          state.positions[state.position].right ||
            state.positions[state.position].left,
        );
});
$("#orientationSelect").addEventListener("change", (e) => {
  state.orientation = e.target.value;
  if (state.pdf)
    state.view === "object"
      ? updateObjectGeometry()
      : adaptBookRatio(
          state.positions[state.position].right ||
            state.positions[state.position].left,
        );
});
$$("[data-view]").forEach((button) =>
  button.addEventListener("click", () => setView(button.dataset.view)),
);
elements.prev.addEventListener("click", () => navigate(-1));
elements.next.addEventListener("click", () => navigate(1));
$("#objectPrev").addEventListener("click", () => navigateObject(-1));
$("#objectNext").addEventListener("click", () => navigateObject(1));
elements.stage.addEventListener("click", (e) => {
  if (e.target.closest("button") || !state.pdf || state.view !== "pages")
    return;
  const box = elements.book.getBoundingClientRect();
  if (e.clientX < box.left + box.width * 0.28) navigate(-1);
  else if (e.clientX > box.right - box.width * 0.28) navigate(1);
});
let pointerStart = null;
elements.book.addEventListener("pointerdown", (e) => {
  pointerStart = { x: e.clientX, y: e.clientY };
  elements.book.setPointerCapture(e.pointerId);
});
elements.book.addEventListener("pointerup", (e) => {
  if (!pointerStart) return;
  const dx = e.clientX - pointerStart.x,
    dy = e.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy))
    navigate(dx < 0 ? 1 : -1);
});
elements.book.addEventListener("pointercancel", () => (pointerStart = null));
document.addEventListener("keydown", (e) => {
  const delta =
    e.key === "ArrowRight" || e.key === "PageDown"
      ? 1
      : e.key === "ArrowLeft" || e.key === "PageUp"
        ? -1
        : 0;
  if (!delta) return;
  state.view === "pages" ? navigate(delta) : navigateObject(delta);
});
function setZoom(value) {
  state.zoom = Math.max(0.6, Math.min(1.5, value));
  document.documentElement.style.setProperty("--zoom", state.zoom);
  elements.objectBook.style.setProperty("--object-scale", state.zoom);
  $("#zoomValue").value = `${Math.round(state.zoom * 100)}%`;
}
$("#zoomIn").addEventListener("click", () => setZoom(state.zoom + 0.1));
$("#zoomOut").addEventListener("click", () => setZoom(state.zoom - 0.1));
let objectDrag = null;
elements.objectStage.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  objectDrag = {
    x: e.clientX,
    y: e.clientY,
    rx: state.objectX,
    ry: state.objectY,
  };
  elements.objectStage.classList.add("dragging");
  elements.objectStage.setPointerCapture(e.pointerId);
});
elements.objectStage.addEventListener("pointermove", (e) => {
  if (!objectDrag) return;
  state.objectY = objectDrag.ry + (e.clientX - objectDrag.x) * 0.45;
  state.objectX = Math.max(
    -75,
    Math.min(75, objectDrag.rx - (e.clientY - objectDrag.y) * 0.35),
  );
  elements.objectBook.style.setProperty("--rx", `${state.objectX}deg`);
  elements.objectBook.style.setProperty("--ry", `${state.objectY}deg`);
});
elements.objectStage.addEventListener("pointerup", () => {
  objectDrag = null;
  elements.objectStage.classList.remove("dragging");
});
elements.objectStage.addEventListener("pointercancel", () => {
  objectDrag = null;
  elements.objectStage.classList.remove("dragging");
});
elements.objectStage.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    setZoom(state.zoom + (e.deltaY < 0 ? 0.08 : -0.08));
  },
  { passive: false },
);
$("#resetObject").addEventListener("click", () => {
  state.objectX = -12;
  state.objectY = -28;
  setZoom(1);
  updateObjectGeometry();
});
$("#fullscreen").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await $("#viewer").requestFullscreen();
    else await document.exitFullscreen();
  } catch (_) {
    toast("Tela cheia não disponível neste navegador.");
  }
});
document.addEventListener("fullscreenchange", () => {
  $("#fullscreen").setAttribute(
    "aria-label",
    document.fullscreenElement ? "Sair da tela cheia" : "Entrar em tela cheia",
  );
});
window.addEventListener("resize", () => {
  if (state.pdf)
    state.view === "object"
      ? updateObjectGeometry()
      : adaptBookRatio(
          state.positions[state.position].right ||
            state.positions[state.position].left,
        );
});
