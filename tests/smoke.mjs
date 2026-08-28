// Smoke test via Chrome DevTools Protocol. Start Chromium with --remote-debugging-port=9223.
const [wsUrl, pdfPath] = process.argv.slice(2);
if (!wsUrl || !pdfPath) throw new Error('Uso: node tests/smoke.mjs <webSocketDebuggerUrl> <pdf absoluto>');

const socket = new WebSocket(wsUrl);
let id = 0;
const waiting = new Map();
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id || !waiting.has(message.id)) return;
  const { resolve, reject } = waiting.get(message.id);
  waiting.delete(message.id);
  message.error ? reject(new Error(message.error.message)) : resolve(message.result);
};
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const callId = ++id; waiting.set(callId, { resolve, reject });
  socket.send(JSON.stringify({ id: callId, method, params }));
});
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

await send('Page.reload', { ignoreCache: true });
await new Promise(resolve => setTimeout(resolve, 2000));
const { root } = await send('DOM.getDocument');
const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#fileInput' });
await evaluate(`document.querySelector('[data-view="pages"]').click()`);
await send('DOM.setFileInputFiles', { nodeId, files: [] });
await send('DOM.setFileInputFiles', { nodeId, files: [pdfPath] });
await new Promise(resolve => setTimeout(resolve, 3500));

const result = await evaluate(`({
  loaded: !document.querySelector('#bookStage').hidden,
  title: document.querySelector('#viewTitle').textContent,
  indicator: document.querySelector('#pageIndicator').textContent,
  sheets: document.querySelector('#sheetInfo').textContent,
  canvasWidth: document.querySelector('#rightPage canvas').width,
  errors: document.querySelector('#toast').textContent
})`);
if (!result.loaded || result.canvasWidth < 10 || result.indicator !== 'Capa') throw new Error(`Falha no carregamento: ${JSON.stringify(result)}`);

await evaluate(`document.querySelector('[data-jump="end"]').click()`);
await new Promise(resolve => setTimeout(resolve, 500));
const endCover = await evaluate(`({ indicator: document.querySelector('#pageIndicator').textContent, endActive: document.querySelector('[data-jump="end"]').classList.contains('active') })`);
if (endCover.indicator !== 'Contracapa' || !endCover.endActive) throw new Error(`Falha ao mostrar a última página: ${JSON.stringify(endCover)}`);
await evaluate(`document.querySelector('[data-jump="start"]').click()`);
await new Promise(resolve => setTimeout(resolve, 500));

await evaluate(`document.querySelector('#nextPage').click()`);
await new Promise(resolve => setTimeout(resolve, 1200));
const afterNext = await evaluate(`({ indicator: document.querySelector('#pageIndicator').textContent, previousEnabled: !document.querySelector('#prevPage').disabled })`);
if (!afterNext.previousEnabled || afterNext.indicator === 'Capa') throw new Error(`Falha na navegação: ${JSON.stringify(afterNext)}`);

await evaluate(`document.querySelector('[data-binding="spiral"]').click()`);
const spiral = await evaluate(`document.querySelector('#book').classList.contains('spiral') && !document.querySelector('#spiralColors').hidden`);
if (!spiral) throw new Error('Falha ao alternar para espiral');
await evaluate(`document.querySelector('[data-binding="brochure"]').click()`);
const brochureRejected = await evaluate(`document.querySelector('#book').classList.contains('spiral') && document.querySelector('[data-binding="spiral"]').classList.contains('active')`);
if (!brochureRejected) throw new Error('PDF fora do múltiplo de 4 foi aceito como brochura');
await evaluate(`document.querySelector('#nextPage').click()`);
await new Promise(resolve => setTimeout(resolve, 150));
const physicalTurn = await evaluate(`({ active: document.querySelector('#book').classList.contains('turning-next'), realBack: document.querySelector('#turnBackCanvas').width > 10 })`);
if (!physicalTurn.active || !physicalTurn.realBack) throw new Error(`Falha na virada física da dupla: ${JSON.stringify(physicalTurn)}`);
await new Promise(resolve => setTimeout(resolve, 700));

await evaluate(`document.querySelector('[data-view="object"]').click()`);
await new Promise(resolve => setTimeout(resolve, 2500));
const object3d = await evaluate(`({
  visible: !document.querySelector('#objectStage').hidden,
  pagesHidden: document.querySelector('#bookStage').hidden,
  frontRendered: document.querySelector('#objectFront').width > 10,
  backRendered: document.querySelector('#objectBack').width > 10,
  thickness: document.querySelector('#thicknessValue').textContent,
  depth: getComputedStyle(document.querySelector('#objectBook')).getPropertyValue('--object-d'),
  spiral: document.querySelector('#objectBook').classList.contains('spiral-3d'),
  coilRings: document.querySelectorAll('#objectCoil i').length
})`);
if (!object3d.visible || !object3d.pagesHidden || !object3d.frontRendered || !object3d.backRendered || !object3d.spiral || object3d.coilRings < 8) throw new Error(`Falha no objeto 3D: ${JSON.stringify(object3d)}`);

await evaluate(`document.querySelector('#objectNext').click()`);
await new Promise(resolve => setTimeout(resolve, 900));
const objectNavigation = await evaluate(`({ indicator: document.querySelector('#pageIndicator').textContent, previousEnabled: !document.querySelector('#objectPrev').disabled, doublePage: document.querySelector('#objectFront').width > document.querySelector('#objectFront').height })`);
if (!objectNavigation.previousEnabled || !objectNavigation.indicator.includes('Páginas 2–3') || !objectNavigation.doublePage) throw new Error(`Falha na navegação 3D: ${JSON.stringify(objectNavigation)}`);

await evaluate(`document.querySelector('[data-paper="150"]').click()`);
await new Promise(resolve => setTimeout(resolve, 300));
const heavierPaper = await evaluate(`({ thickness: document.querySelector('#thicknessValue').textContent, depth: getComputedStyle(document.querySelector('#objectBook')).getPropertyValue('--object-d') })`);
if (heavierPaper.thickness === object3d.thickness || heavierPaper.depth === object3d.depth) throw new Error(`A gramatura não alterou a espessura: ${JSON.stringify(heavierPaper)}`);

console.log(JSON.stringify({ load: result, endCover, navigation: afterNext, spiral, brochureRejected, physicalTurn, object3d, objectNavigation, heavierPaper }, null, 2));
socket.close();
