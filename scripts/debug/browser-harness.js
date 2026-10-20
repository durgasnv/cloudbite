const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function browser(script) {
  const nodes = new Map();
  const values = new Map();
  const events = new Map();
  const context = vm.createContext({
    console: { error() {}, warn() {} }, crypto: require('node:crypto').webcrypto,
    document: { activeElement: null, addEventListener(name, handler) { events.set(name, handler); },
      getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
      createElement: element, createDocumentFragment: element, querySelectorAll: () => [] },
    window: { addEventListener() {}, location: { pathname: '/test.html', search: '' } },
    Option: function(text, value) { return Object.assign(element(), { text, value }); },
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }
  });
  function element() {
    const listeners = new Map();
    const attributes = new Map();
    return { value: '', textContent: '', children: [], style: {}, disabled: false, hidden: false,
      classList: { add() {}, remove() {}, contains() { return false; } },
      set innerHTML(value) { if (value !== '') throw new Error('Unsafe HTML'); this.children = []; },
      appendChild(child) { this.children.push(child); }, append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; }, add(child) { this.children.push(child); },
      setAttribute(name, value) { attributes.set(name, value); }, getAttribute(name) { return attributes.get(name); },
      addEventListener(name, handler) { listeners.set(name, handler); },
      fire(name, event = {}) { return listeners.get(name)?.(event); }, querySelectorAll() { return []; },
      querySelector() { return null; }, focus() { context.document.activeElement = this; } };
  }
  for (const name of ['app', script]) vm.runInContext(fs.readFileSync(path.resolve(__dirname, `../../client/js/${name}.js`), 'utf8'), context);
  context.showToast = () => {};
  return { context, node: id => context.document.getElementById(id), values, events,
    run: source => vm.runInContext(source, context),
    all(root) { const result = []; const walk = node => { result.push(node); node.children.forEach(walk); }; walk(root); return result; } };
}
module.exports = { browser };
