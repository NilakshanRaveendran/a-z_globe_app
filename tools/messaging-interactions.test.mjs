import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

// Exercise the component's event handlers with deterministic timers. Leaf UI
// components are inert so these tests focus on gestures rather than MUI internals.
const shim = `
export const useRef = value => ({ current: value });
export const useEffect = () => {};
export const jsx = (type, props) => ({ type, props });
export const jsxs = jsx;
export const Fragment = 'fragment';
export default 'control';
export const colors = { onPrimary: '#fff', textMuted: '#999', primary: '#d42b2b' };
export const preview = message => message.text;
export const fileKind = () => 'image';
export const isVisual = () => true;
export const Avatar = 'avatar', MIcon = 'icon', AudioMessage = 'audio', FileMessage = 'file', MediaThumb = 'media', VoiceMessage = 'voice';
export const time = () => '10:00';
export const toneFor = () => ({ color: '#000' });
`;
const result = await build({ entryPoints: ['apps/azglobe/src/modules/messaging/MessageBubble.web.tsx'], bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic', plugins: [{ name: 'leaves', setup(b) {
  b.onResolve({ filter: /^(react|@mui\/|@core\/|\.\/)/ }, args => args.kind === 'entry-point' ? undefined : ({ path: args.path, namespace: 'leaf' }));
  b.onLoad({ filter: /.*/, namespace: 'leaf' }, () => ({ contents: shim }));
} }] });
const { MessageBubble, linkParts } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
function render(overrides = {}) {
  let selections = 0, menus = 0;
  const root = MessageBubble({ message: { id: 'm', sender: 'me', name: 'Me', text: 'Hello', kind: 'text', at: 1, reactions: {}, status: 'sent', ...overrides.message }, user: { id: 'me' }, onSelect: () => selections++, onMenu: () => menus++, ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== "message")) });
  return { root, bubble: nodes(root).find(n => n.props?.className === 'azm-bubble'), counts: () => ({ selections, menus }) };
}
const pointer = (x = 0) => ({ button: 0, clientX: x, clientY: 0, target: { closest: () => null } });
const click = () => ({ preventDefault() {}, stopPropagation() {} });

test('long press opens the popup without selecting and release does not activate the message', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = render();
  r.bubble.props.onPointerDown(pointer());
  t.mock.timers.tick(480);
  r.bubble.props.onPointerUp();
  r.root.props.onClickCapture(click());
  assert.deepEqual(r.counts(), { selections: 0, menus: 1 });
});
test('scrolling and short taps do not start selection', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = render();
  r.bubble.props.onPointerDown(pointer());
  r.bubble.props.onPointerMove(pointer(30));
  t.mock.timers.tick(500);
  r.bubble.props.onPointerDown(pointer());
  r.bubble.props.onPointerUp();
  t.mock.timers.tick(500);
  assert.deepEqual(r.counts(), { selections: 0, menus: 0 });
});
test('selection mode captures child clicks before links, media and poll actions', () => {
  const r = render({ selectionMode: true, checked: true });
  let prevented = false, stopped = false;
  r.root.props.onClickCapture({ preventDefault: () => prevented = true, stopPropagation: () => stopped = true });
  assert.ok(prevented && stopped);
  assert.equal(r.counts().selections, 1);
  assert.equal(nodes(r.root).find(n => n.props?.role === 'checkbox').props['aria-checked'], true);
});
test('sent has one tick, delivered and read have double ticks with distinct styles', () => {
  for (const status of ['sent', 'delivered', 'read']) {
    const r = render({ message: { status } });
    const receipt = nodes(r.root).find(n => n.props?.className === `azm-receipt ${status}`);
    assert.ok(receipt);
    assert.equal(nodes(receipt).find(n => n.type === 'icon').props.name, status === 'sent' ? 'sent' : 'read');
  }
});

test('starred messages show a small star in the timestamp, unstarred messages do not', () => {
  const r = render({ starred: true });
  const stamp = nodes(r.root).find(n => n.props?.className === 'azm-stamp');
  assert.equal(nodes(stamp).find(n => n.props?.name === 'starFilled').props.size, 16);
  assert.equal(nodes(render().root).some(n => n.props?.name === 'starFilled'), false);
});

test('web links become safe clickable URLs without swallowing punctuation', () => {
  assert.deepEqual(linkParts('Visit https://example.com/a?q=1, or www.example.org.'), [
    { text: 'Visit ' }, { text: 'https://example.com/a?q=1', href: 'https://example.com/a?q=1' },
    { text: ', or ' }, { text: 'www.example.org', href: 'https://www.example.org/' }, { text: '.' },
  ]);
  assert.deepEqual(linkParts('javascript:alert(1) <script>'), [{ text: 'javascript:alert(1) <script>' }]);
});
