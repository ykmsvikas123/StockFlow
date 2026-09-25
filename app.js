import {
  loadState,
  saveState,
  clearLocalState,
  getDeviceId,
  serializeState,
  parseState,
  downloadState,
} from './db.js';
import { syncWithServer, SyncError } from './sync.js';

// -----------------------------------------------------------------------------
// App constants and small utilities
// -----------------------------------------------------------------------------

const APP_VERSION = 1;
const COMPANY_ID = '146enterprises';
const DEFAULT_STAGES = [
  { key: 'weaving', label: 'Weaving', shortLabel: 'Weaving', type: 'outside' },
  { key: 'woven_received', label: 'Woven fabric received', shortLabel: 'Woven fabric', type: 'internal' },
  { key: 'cutting', label: 'Cutting', shortLabel: 'Cutting', type: 'internal' },
  { key: 'carbonization', label: 'Carbonization', shortLabel: 'Carbonization', type: 'outside' },
  { key: 'dyeing', label: 'Dyeing', shortLabel: 'Dyeing', type: 'outside' },
  { key: 'inspection', label: 'Quality inspection', shortLabel: 'Inspection', type: 'internal' },
  { key: 'pressing', label: 'Pressing', shortLabel: 'Pressing', type: 'outside' },
  { key: 'packing', label: 'Packing', shortLabel: 'Packing', type: 'internal' },
  { key: 'finished_stock', label: 'Finished stock', shortLabel: 'Finished stock', type: 'internal' },
];

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'batches', label: 'Production batches', icon: 'layers' },
  { key: 'inventory', label: 'Stock & inventory', icon: 'box' },
  { key: 'outside', label: 'Outside work', icon: 'route' },
  { key: 'quality', label: 'Quality control', icon: 'shield' },
  { key: 'customers', label: 'Customers & issues', icon: 'users' },
  { key: 'notes', label: 'Notes & decisions', icon: 'note' },
  { key: 'alerts', label: 'Alerts', icon: 'bell' },
];

const STAGE_BY_KEY = Object.fromEntries(DEFAULT_STAGES.map((stage) => [stage.key, stage]));
const STAGE_INDEX = Object.fromEntries(DEFAULT_STAGES.map((stage, index) => [stage.key, index]));
const CURRENT_USER_KEY = 'pashmina-flow-current-user';

const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  layers: '<path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3Z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',
  box: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18h2a4 4 0 0 0 4-4v-4a4 4 0 0 1 4-4"/>',
  shield: '<path d="M12 3 20 6v5c0 5.1-3.4 8.5-8 10-4.6-1.5-8-4.9-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 11a3.5 3.5 0 0 0 0-7M21 20v-1.5a4 4 0 0 0-3-3.85"/>',
  note: '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v20H7.5A2.5 2.5 0 0 1 5 19.5v-15Z"/><path d="M5 19.5A2.5 2.5 0 0 1 7.5 17H19M9 7h6M9 10h6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.3a2 2 0 1 1-4 0v-.2a2 2 0 0 0-3.4-1.5l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 3.7 11H3.5a2 2 0 1 1 0-4h.2a2 2 0 0 0 1.4-3.4L5 3.5A2 2 0 1 1 7.8.7l.1.1A2 2 0 0 0 11.3-.6V-.9a2 2 0 1 1 4 0v.2a2 2 0 0 0 3.4 1.4l.1-.1A2 2 0 1 1 21.6 3l-.1.1A2 2 0 0 0 22.9 6h.2a2 2 0 1 1 0 4h-.2a2 2 0 0 0-1.5 3Z" transform="translate(-1.4 1.4) scale(.92)"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  warning: '<path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4M12 16h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.7-4L3 10"/><path d="M3 5v5h5M4 13a8 8 0 0 0 14.7 4L21 14"/><path d="M21 19v-5h-5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  edit: '<path d="m4 16-.8 4.8L8 20l11.3-11.3a2.1 2.1 0 0 0-3-3L5 17Z"/><path d="m14.8 7.2 3 3"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
  factory: '<path d="M3 21V9l6 3V8l6 4V5h6v16H3Z"/><path d="M7 17h.01M11 17h.01M15 17h.01M19 17h.01"/>',
  chart: '<path d="M4 19V5M4 19h17"/><path d="m7 15 3-4 3 2 5-7"/>',
  location: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  sparkle: '<path d="m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3L12 3ZM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z"/>',
};

let appState;
let currentView = 'dashboard';
let selectedBatchId = null;
let modalState = null;
let searchTerm = '';
let batchFilters = { status: 'all', stage: 'all' };
let inventoryTab = 'thread';
let session = { role: 'owner', employeeId: 'owner' };
let menuOpen = false;
let saveTimer = null;

function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.sparkle}</svg>`;
}

function uid(prefix = 'id') {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[character]));
}

function todayISO() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

function dateFromToday(days = 0) {
  const date = new Date(`${todayISO()}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatShortDate(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short' }).format(date);
}

function formatNumber(value, decimals = 0) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('en', { maximumFractionDigits: decimals }).format(number);
}

function formatKg(value) {
  return `${formatNumber(value, 1)} kg`;
}

function initials(name) {
  return String(name || 'O').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function titleCase(value) {
  return String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function nowISO() {
  return new Date().toISOString();
}

function currentActor() {
  if (session.role === 'owner') return 'Owner';
  return appState?.users?.find((user) => user.id === session.employeeId)?.name || 'Employee';
}

function getProduct(productId) {
  return appState.products.find((product) => product.id === productId) || null;
}

function getBatch(batchId) {
  return appState.batches.find((batch) => batch.id === batchId) || null;
}

function getLocation(locationId) {
  return appState.locations.find((location) => location.id === locationId) || null;
}

function getVendor(vendorId) {
  return appState.vendors.find((vendor) => vendor.id === vendorId) || null;
}

function getCustomer(customerId) {
  return appState.customers.find((customer) => customer.id === customerId) || null;
}

function getStage(batch, stageKey) {
  return batch?.stages?.find((stage) => stage.key === stageKey) || null;
}

function getCurrentStage(batch) {
  return getStage(batch, batch?.currentStage) || DEFAULT_STAGES[0];
}

function getStageLabel(batch) {
  return getCurrentStage(batch)?.shortLabel || getCurrentStage(batch)?.label || 'Not started';
}

function getBatchAvailable(batch) {
  return Math.max(0, Number(batch.finishedPieces || 0) - Number(batch.issuedPieces || 0));
}

function isBatchComplete(batch) {
  return batch.status === 'completed' || (batch.currentStage === 'finished_stock' && getStage(batch, 'finished_stock')?.status === 'completed');
}

function getBatchStatusLabel(batch) {
  if (isBatchComplete(batch)) return 'Completed';
  if (batch.status === 'exception') return 'Needs attention';
  if (batch.currentStage === 'finished_stock') return 'Finished stock';
  return 'In production';
}

function statusBadge(status, label = titleCase(status)) {
  const normalized = String(status || '').toLowerCase();
  const tone = ['completed', 'complete', 'pass', 'accepted', 'available'].includes(normalized)
    ? 'success'
    : ['exception', 'rejected', 'reject', 'overdue', 'low'].includes(normalized)
      ? 'danger'
      : ['rework', 'pending', 'sent', 'in_progress', 'progress'].includes(normalized)
        ? 'warning'
        : 'neutral';
  return `<span class="badge badge-${tone}">${escapeHtml(label)}</span>`;
}

function stageStatusBadge(status) {
  const labels = {
    pending: 'Pending',
    in_progress: 'In progress',
    sent: 'Sent outside',
    completed: 'Completed',
    exception: 'Exception',
    rework: 'Rework',
    rejected: 'Rejected',
  };
  return statusBadge(status, labels[status] || titleCase(status));
}

function emptyState(iconName, title, body, action = '') {
  return `<div class="empty-state">${icon(iconName, 'empty-icon')}<h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p>${action}</div>`;
}

function pageHeading(eyebrow, title, description, actionHtml = '') {
  return `<div class="page-heading"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${actionHtml ? `<div class="page-heading-actions">${actionHtml}</div>` : ''}</div>`;
}

function button(label, action, variant = 'primary', extra = '') {
  return `<button class="button button-${variant}" type="button" data-action="${action}" ${extra}>${label}</button>`;
}

function selectOptions(items, selectedValue, valueKey = 'id', labelKey = 'name', placeholder = 'Select…') {
  return `<option value="">${escapeHtml(placeholder)}</option>${items.map((item) => `<option value="${escapeHtml(item[valueKey])}" ${String(item[valueKey]) === String(selectedValue) ? 'selected' : ''}>${escapeHtml(item[labelKey])}</option>`).join('')}`;
}

// -----------------------------------------------------------------------------
// Sample data and state normalization
// -----------------------------------------------------------------------------

function makeStage(key, status = 'pending', extra = {}) {
  const definition = STAGE_BY_KEY[key];
  return {
    key,
    label: definition.label,
    type: definition.type,
    status,
    sentQty: '',
    receivedQty: '',
    lossQty: 0,
    expectedDate: '',
    vendorId: '',
    notes: '',
    ...extra,
  };
}

function makeBatch({ id, batchNo, productId, color, initialPieces, threadKg, currentStage, expectedDate, locationId, vendorId, status = 'in_progress', finishedPieces = 0, issuedPieces = 0, lossPieces = 0, notes = '', quality = [], issues = [], dueStage = null }) {
  const currentIndex = Math.max(0, STAGE_INDEX[currentStage] ?? 0);
  const stages = DEFAULT_STAGES.map((definition, index) => {
    let status = 'pending';
    if (index < currentIndex) status = 'completed';
    if (index === currentIndex) status = currentStage === 'inspection' ? 'in_progress' : (currentStage === 'weaving' || currentStage === 'carbonization' || currentStage === 'dyeing' || currentStage === 'pressing') ? 'sent' : 'in_progress';
    if (currentStage === 'finished_stock' && index === currentIndex) status = 'completed';
    const extra = {};
    if (definition.type === 'outside' && index <= currentIndex) {
      extra.vendorId = vendorId || '';
      extra.sentQty = index === currentIndex ? initialPieces : initialPieces;
      extra.expectedDate = expectedDate || '';
      extra.receivedQty = index < currentIndex ? initialPieces : '';
    }
    if (index < currentIndex) extra.receivedQty = initialPieces;
    if (definition.key === currentStage) extra.receivedQty = status === 'completed' ? initialPieces : extra.receivedQty;
    return makeStage(definition.key, status, extra);
  });
  return {
    id,
    batchNo,
    productId,
    color,
    initialPieces: Number(initialPieces),
    threadKg: Number(threadKg),
    currentStage,
    status,
    expectedDate: expectedDate || '',
    locationId: locationId || 'loc-shop',
    finishedPieces: Number(finishedPieces),
    issuedPieces: Number(issuedPieces),
    lossPieces: Number(lossPieces),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    stages,
    quality,
    notes,
    issues,
    dueStage,
  };
}

function createSampleState() {
  const locations = [
    { id: 'loc-shop', name: 'Main shop', type: 'internal' },
    { id: 'loc-weave', name: 'Outside weaving', type: 'outside' },
    { id: 'loc-carbon', name: 'Outside carbonization', type: 'outside' },
    { id: 'loc-dye', name: 'Outside dyeing', type: 'outside' },
    { id: 'loc-press', name: 'Outside pressing', type: 'outside' },
    { id: 'loc-finished', name: 'Finished stock room', type: 'internal' },
  ];
  const products = [
    { id: 'product-pashmina-28', category: 'Pashmina', name: 'Fine-wool pashmina', size: '28 × 80', weightPerPiece: 0.72, color: 'Ivory', fabricType: 'Fine wool', style: 'Plain', custom: {} },
    { id: 'product-stole-40', category: 'Stole', name: 'Printed stole', size: '40 × 80', weightPerPiece: 0.86, color: 'Rust', fabricType: 'Fine wool', style: 'Printed', custom: {} },
    { id: 'product-lohi-50', category: 'Lohi', name: 'Checked lohi', size: '50 × 100', weightPerPiece: 1.08, color: 'Charcoal', fabricType: 'Pashmina blend', style: 'Checked', custom: {} },
    { id: 'product-pashmina-50', category: 'Pashmina', name: 'Fine-wool pashmina', size: '50 × 100', weightPerPiece: 0.95, color: 'Moss', fabricType: 'Fine wool', style: 'Plain', custom: {} },
  ];
  const vendors = [
    { id: 'vendor-weaver-1', name: 'Srinagar weaving unit', stage: 'weaving', phone: '' },
    { id: 'vendor-carbon-1', name: 'Carbonization unit A', stage: 'carbonization', phone: '' },
    { id: 'vendor-dye-1', name: 'Dyeing unit B', stage: 'dyeing', phone: '' },
    { id: 'vendor-press-1', name: 'Pressing unit C', stage: 'pressing', phone: '' },
  ];
  const customers = [
    { id: 'customer-1', name: 'Meera Traders', phone: '', address: 'Srinagar' },
    { id: 'customer-2', name: 'Northline Exports', phone: '', address: 'Delhi' },
    { id: 'customer-3', name: 'Ravi Boutique', phone: '', address: 'Srinagar' },
  ];
  const threadStock = [
    { id: 'thread-ivory', name: 'Ivory fine-wool thread', color: 'Ivory', quantityKg: 82, minKg: 45, locationId: 'loc-shop' },
    { id: 'thread-rust', name: 'Rust fine-wool thread', color: 'Rust', quantityKg: 31, minKg: 30, locationId: 'loc-shop' },
    { id: 'thread-charcoal', name: 'Charcoal blend thread', color: 'Charcoal', quantityKg: 54, minKg: 25, locationId: 'loc-shop' },
  ];
  const batchOne = makeBatch({
    id: 'batch-001', batchNo: 'PASH-26001', productId: products[0].id, color: 'Ivory', initialPieces: 40, threadKg: 31, currentStage: 'weaving', expectedDate: dateFromToday(4), locationId: 'loc-weave', vendorId: 'vendor-weaver-1', notes: 'Weaver confirmed the first lot. Keep the ivory shade consistent.', dueStage: 'weaving',
  });
  const batchTwo = makeBatch({
    id: 'batch-002', batchNo: 'STL-26002', productId: products[1].id, color: 'Rust', initialPieces: 60, threadKg: 46, currentStage: 'inspection', expectedDate: dateFromToday(1), locationId: 'loc-shop', status: 'exception', notes: 'A few pieces need a second look after dyeing.', quality: [{ id: 'quality-1', batchId: 'batch-002', result: 'rework', reason: 'Uneven shade on a small section', notes: 'Send 4 pieces back for rework.', checkedBy: 'Owner', checkedAt: nowISO() }], dueStage: 'inspection',
  });
  const batchThree = makeBatch({
    id: 'batch-003', batchNo: 'LOHI-26003', productId: products[2].id, color: 'Charcoal', initialPieces: 24, threadKg: 19, currentStage: 'finished_stock', expectedDate: dateFromToday(-2), locationId: 'loc-finished', status: 'completed', finishedPieces: 22, issuedPieces: 2, lossPieces: 2, quality: [{ id: 'quality-2', batchId: 'batch-003', result: 'pass', reason: '', notes: 'Checked after pressing.', checkedBy: 'Aisha', checkedAt: nowISO() }], issues: [{ id: 'issue-1', customerId: 'customer-1', batchId: 'batch-003', pieces: 2, date: dateFromToday(-1), promisedDate: '', returnedPieces: 0, replacedPieces: 0, note: 'Picked up from finished stock.', returnType: '', returnReason: '' }], notes: 'Two pieces were rejected at final inspection. Remaining stock is ready for orders.', dueStage: 'finished_stock',
  });
  const batchFour = makeBatch({
    id: 'batch-004', batchNo: 'PASH-26004', productId: products[3].id, color: 'Moss', initialPieces: 35, threadKg: 26, currentStage: 'cutting', expectedDate: dateFromToday(8), locationId: 'loc-shop', notes: 'Cut after checking the woven length.', dueStage: 'cutting',
  });
  return {
    meta: {
      version: APP_VERSION,
      serverVersion: 0,
      lastSyncAt: null,
      localOnly: true,
    },
    company: { id: COMPANY_ID, name: '146enterprises' },
    products,
    locations,
    vendors,
    customers,
    threadStock,
    batches: [batchOne, batchTwo, batchThree, batchFour],
    movements: [
      { id: 'movement-1', type: 'in', item: 'Ivory fine-wool thread', quantity: 82, unit: 'kg', locationId: 'loc-shop', batchId: '', note: 'Opening sample stock', at: nowISO(), actor: 'Owner' },
      { id: 'movement-2', type: 'out', item: 'Ivory fine-wool thread', quantity: 31, unit: 'kg', locationId: 'loc-shop', batchId: 'batch-001', note: 'Issued to weaving', at: nowISO(), actor: 'Owner' },
    ],
    notes: [
      { id: 'note-1', batchId: 'batch-002', text: 'Do not release the rust batch until the shade issue is checked.', author: 'Owner', createdAt: nowISO() },
    ],
    quality: [...batchTwo.quality, ...batchThree.quality],
    notifications: [],
    activity: [
      { id: 'activity-1', text: 'Sample workspace loaded with four production batches.', at: nowISO(), actor: 'System', type: 'system' },
      { id: 'activity-2', text: 'LOHI-26003 was moved to finished stock.', at: nowISO(), actor: 'Aisha', type: 'stage' },
      { id: 'activity-3', text: '2 pieces from LOHI-26003 were issued to Meera Traders.', at: nowISO(), actor: 'Owner', type: 'customer' },
    ],
    customFields: [],
    users: [
      { id: 'owner', name: 'Owner', role: 'owner', active: true },
      { id: 'employee-aisha', name: 'Aisha', role: 'employee', active: true },
      { id: 'employee-imran', name: 'Imran', role: 'employee', active: true },
      { id: 'employee-rizwan', name: 'Rizwan', role: 'employee', active: true },
    ],
    settings: {
      lowStockKg: 30,
      alertLeadDays: 2,
      companyName: '146enterprises',
    },
  };
}

function normalizeState(raw) {
  const base = createSampleState();
  if (!raw || typeof raw !== 'object') return base;
  const merged = {
    ...base,
    ...raw,
    meta: { ...base.meta, ...(raw.meta || {}) },
    company: { ...base.company, ...(raw.company || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) },
  };
  for (const key of ['products', 'locations', 'vendors', 'customers', 'threadStock', 'batches', 'movements', 'notes', 'quality', 'notifications', 'activity', 'customFields', 'users']) {
    if (!Array.isArray(merged[key])) merged[key] = base[key];
  }
  merged.batches = merged.batches.map((batch) => {
    const stages = Array.isArray(batch.stages) ? batch.stages : [];
    const normalizedStages = DEFAULT_STAGES.map((definition) => {
      const existing = stages.find((stage) => stage.key === definition.key) || {};
      return { ...makeStage(definition.key), ...existing, type: definition.type, label: definition.label };
    });
    return {
      ...batch,
      initialPieces: Number(batch.initialPieces || 0),
      threadKg: Number(batch.threadKg || 0),
      finishedPieces: Number(batch.finishedPieces || 0),
      issuedPieces: Number(batch.issuedPieces || 0),
      lossPieces: Number(batch.lossPieces || 0),
      quality: Array.isArray(batch.quality) ? batch.quality : [],
      issues: Array.isArray(batch.issues) ? batch.issues : [],
      stages: normalizedStages,
    };
  });
  return merged;
}

// -----------------------------------------------------------------------------
// Alerts, activity, and derived metrics
// -----------------------------------------------------------------------------

function rebuildAlerts() {
  if (!appState) return;
  const generated = [];
  const today = todayISO();
  const lead = Number(appState.settings.alertLeadDays || 2);
  const lowLimit = Number(appState.settings.lowStockKg || 30);
  const generatedKeys = new Set();

  const addAlert = (alert) => {
    if (!alert.key || generatedKeys.has(alert.key)) return;
    generatedKeys.add(alert.key);
    generated.push({
      id: uid('alert'),
      auto: true,
      resolved: false,
      read: false,
      createdAt: nowISO(),
      ...alert,
    });
  };

  appState.threadStock.forEach((item) => {
    const threshold = Number(item.minKg || lowLimit);
    if (Number(item.quantityKg) <= threshold) {
      addAlert({
        key: `low-thread-${item.id}`,
        type: 'low-stock',
        title: `${item.name} is low`,
        message: `${formatKg(item.quantityKg)} remain. The alert level is ${formatKg(threshold)}.`,
        relatedId: item.id,
      });
    }
  });

  appState.batches.forEach((batch) => {
    if (isBatchComplete(batch)) return;
    const currentStage = getCurrentStage(batch);
    if (currentStage?.type === 'outside' && ['sent', 'in_progress'].includes(currentStage.status)) {
      const due = currentStage.expectedDate || batch.expectedDate;
      if (due && due <= dateFromToday(lead)) {
        addAlert({
          key: `due-${batch.id}-${currentStage.key}`,
          type: 'deadline',
          title: `${batch.batchNo} · ${currentStage.shortLabel} due soon`,
          message: due < today ? 'The outside work is past its expected return date.' : 'The expected return date is approaching.',
          relatedId: batch.id,
        });
      }
    }
    if (batch.currentStage === 'inspection') {
      const latest = batch.quality?.[batch.quality.length - 1];
      if (!latest || ['rework', 'rejected'].includes(latest.result)) {
        addAlert({
          key: `inspection-${batch.id}`,
          type: 'quality',
          title: `${batch.batchNo} needs inspection`,
          message: latest?.result === 'rework' ? 'A rework result is waiting for the next check.' : 'Record the quality result to continue the batch.',
          relatedId: batch.id,
        });
      }
    }
    if (batch.expectedDate && batch.expectedDate <= dateFromToday(lead) && batch.expectedDate < today) {
      addAlert({
        key: `batch-late-${batch.id}`,
        type: 'deadline',
        title: `${batch.batchNo} is behind schedule`,
        message: `The expected date was ${formatDate(batch.expectedDate)}.`,
        relatedId: batch.id,
      });
    }
    batch.issues?.forEach((issue) => {
      if (issue.promisedDate && issue.promisedDate <= dateFromToday(lead) && issue.deliveredPieces < issue.pieces) {
        addAlert({
          key: `customer-date-${issue.id}`,
          type: 'customer',
          title: `Customer date for ${getCustomer(issue.customerId)?.name || 'customer'}`,
          message: `${issue.pieces - Number(issue.deliveredPieces || 0)} piece(s) are still not marked delivered.`,
          relatedId: issue.id,
        });
      }
    });
  });

  const oldByKey = new Map(appState.notifications.filter((item) => item.auto && item.key).map((item) => [item.key, item]));
  const manual = appState.notifications.filter((item) => !item.auto);
  const next = [...manual];
  generated.forEach((alert) => {
    const old = oldByKey.get(alert.key);
    if (old) next.push({ ...old, ...alert, id: old.id, read: old.read, resolved: false });
    else next.push(alert);
  });
  oldByKey.forEach((old, key) => {
    if (!generatedKeys.has(key)) next.push({ ...old, resolved: true });
  });
  appState.notifications = next.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function getOpenAlerts() {
  return appState.notifications.filter((item) => !item.resolved);
}

function getUnreadAlerts() {
  return getOpenAlerts().filter((item) => !item.read);
}

function addActivity(text, type = 'general', relatedId = '') {
  appState.activity.unshift({ id: uid('activity'), text, type, relatedId, at: nowISO(), actor: currentActor() });
  appState.activity = appState.activity.slice(0, 80);
}

function addMovement(movement) {
  appState.movements.unshift({ id: uid('movement'), at: nowISO(), actor: currentActor(), ...movement });
  appState.movements = appState.movements.slice(0, 150);
}

function totalThreadKg() {
  return appState.threadStock.reduce((total, item) => total + Number(item.quantityKg || 0), 0);
}

function totalFinishedPieces() {
  return appState.batches.reduce((total, batch) => total + getBatchAvailable(batch), 0);
}

function totalIssuedPieces() {
  return appState.batches.reduce((total, batch) => total + Number(batch.issuedPieces || 0), 0);
}

function totalLossPieces() {
  return appState.batches.reduce((total, batch) => total + Number(batch.lossPieces || 0), 0);
}

function productionBatches() {
  return appState.batches.filter((batch) => !isBatchComplete(batch));
}

function pipelineBatches(stageKey) {
  return appState.batches.filter((batch) => batch.currentStage === stageKey);
}

function qualityRecords() {
  return appState.quality || appState.batches.flatMap((batch) => batch.quality || []);
}

function qualityStats() {
  const records = qualityRecords();
  return {
    pass: records.filter((record) => record.result === 'pass').length,
    rework: records.filter((record) => record.result === 'rework').length,
    reject: records.filter((record) => ['reject', 'rejected'].includes(record.result)).length,
  };
}

function sumStagePieces(stageKey) {
  return pipelineBatches(stageKey).reduce((total, batch) => total + Number(batch.initialPieces || 0), 0);
}

// -----------------------------------------------------------------------------
// Shared render components
// -----------------------------------------------------------------------------

function metricCard(label, value, detail, iconName, tone = 'teal') {
  return `<article class="metric-card metric-${tone}"><div class="metric-icon">${icon(iconName)}</div><div><span class="metric-label">${escapeHtml(label)}</span><strong class="metric-value">${escapeHtml(value)}</strong><span class="metric-detail">${escapeHtml(detail)}</span></div></article>`;
}

function renderNav() {
  const active = currentView === 'batch-detail' ? 'batches' : currentView;
  const nav = NAV_ITEMS.map((item) => `<button class="nav-item ${active === item.key ? 'is-active' : ''}" data-view="${item.key}" type="button">${icon(item.icon, 'nav-icon-svg')}<span>${escapeHtml(item.label)}</span>${item.key === 'alerts' ? `<span class="nav-alert-count">${getUnreadAlerts().length}</span>` : ''}</button>`).join('');
  document.querySelector('#main-nav').innerHTML = nav;
}

function renderHeader() {
  const headings = {
    dashboard: 'Dashboard',
    batches: 'Production batches',
    'batch-detail': 'Batch detail',
    inventory: 'Stock & inventory',
    outside: 'Outside work',
    quality: 'Quality control',
    customers: 'Customers & issues',
    notes: 'Notes & decisions',
    alerts: 'Alerts',
    learn: 'Learn the system',
    settings: 'Settings',
  };
  document.querySelector('#page-context').textContent = headings[currentView] || '146enterprises';
  const count = getUnreadAlerts().length;
  const countNode = document.querySelector('#notification-count');
  if (countNode) {
    countNode.textContent = count > 99 ? '99+' : String(count);
    countNode.classList.toggle('has-alerts', count > 0);
  }
  const user = session.role === 'owner'
    ? { name: 'Owner', role: 'Owner access' }
    : { name: appState.users.find((item) => item.id === session.employeeId)?.name || 'Employee', role: 'Employee access' };
  document.querySelector('#user-name').textContent = user.name;
  document.querySelector('#user-avatar').textContent = initials(user.name);
  const userCopy = document.querySelector('.user-chip-copy small');
  if (userCopy) userCopy.textContent = user.role;
}

function renderSyncIndicator() {
  const node = document.querySelector('#sync-indicator');
  if (!node) return;
  const online = navigator.onLine;
  const lastSync = appState.meta.lastSyncAt;
  const text = !online ? 'Offline' : lastSync ? `Synced ${formatShortDate(lastSync)}` : 'Local mode';
  node.innerHTML = `<span class="status-dot ${online ? '' : 'offline-dot'}"></span><span>${escapeHtml(text)}</span>`;
}

function renderApp() {
  rebuildAlerts();
  renderNav();
  renderHeader();
  renderSyncIndicator();
  const content = document.querySelector('#app-content');
  content.innerHTML = renderView();
}

function renderView() {
  switch (currentView) {
    case 'dashboard': return renderDashboard();
    case 'batches': return renderBatches();
    case 'batch-detail': return renderBatchDetail();
    case 'inventory': return renderInventory();
    case 'outside': return renderOutside();
    case 'quality': return renderQuality();
    case 'customers': return renderCustomers();
    case 'notes': return renderNotes();
    case 'alerts': return renderAlerts();
    case 'learn': return renderLearn();
    case 'settings': return renderSettings();
    default: return renderDashboard();
  }
}

function renderDashboard() {
  const activeBatches = productionBatches();
  const alerts = getOpenAlerts();
  const stats = qualityStats();
  const stageCards = DEFAULT_STAGES.map((stage) => {
    const batches = pipelineBatches(stage.key);
    const isActive = stage.key === 'finished_stock' ? batches.filter(isBatchComplete).length : batches.length;
    return `<button class="pipeline-card ${batches.length ? 'has-batches' : ''}" type="button" data-action="view-stage" data-stage="${stage.key}"><span class="pipeline-icon">${icon(stage.type === 'outside' ? 'route' : stage.key === 'inspection' ? 'shield' : 'layers')}</span><span class="pipeline-label">${escapeHtml(stage.shortLabel)}</span><strong>${isActive}</strong><small>${formatNumber(sumStagePieces(stage.key))} pcs</small></button>`;
  }).join('');
  const attention = alerts.slice(0, 5).map((alert) => `<button class="attention-row" type="button" data-action="open-alert" data-alert-id="${alert.id}"><span class="attention-icon attention-${escapeHtml(alert.type)}">${icon(alert.type === 'low-stock' ? 'box' : alert.type === 'quality' ? 'shield' : 'clock')}</span><span class="attention-copy"><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.message)}</small></span><span class="attention-arrow">${icon('arrow')}</span></button>`).join('');
  const recent = [...activeBatches].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 5).map((batch) => batchTableRow(batch, true)).join('');
  return `<div class="dashboard-page">
    <div class="hero-panel">
      <div class="hero-copy"><span class="eyebrow light-eyebrow">${formatDate(todayISO())}</span><h1>Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${escapeHtml(session.role === 'owner' ? 'Owner' : currentActor())}.</h1><p>Follow every pashmina batch from thread to customer, even when the shop Wi-Fi is unavailable.</p><div class="hero-actions">${button(`${icon('plus')} New batch`, 'new-batch', 'light')}${button(`${icon('upload')} Receive thread`, 'receive-thread', 'ghost-light')}</div></div>
      <div class="hero-orbit"><div class="orbit-ring orbit-ring-one"></div><div class="orbit-ring orbit-ring-two"></div><div class="orbit-core">PF</div><span class="orbit-label orbit-label-top">TRACK</span><span class="orbit-label orbit-label-right">CHECK</span><span class="orbit-label orbit-label-bottom">DELIVER</span></div>
    </div>
    <div class="metric-grid">${metricCard('Thread available', formatKg(totalThreadKg()), `${appState.threadStock.length} thread lots`, 'box', 'teal')}${metricCard('In production', formatNumber(activeBatches.length), `${formatNumber(activeBatches.reduce((sum, batch) => sum + batch.initialPieces, 0))} pieces tracked`, 'layers', 'blue')}${metricCard('Finished available', formatNumber(totalFinishedPieces()), `${formatNumber(totalIssuedPieces())} pieces issued`, 'sparkle', 'gold')}${metricCard('Open alerts', formatNumber(alerts.length), alerts.length ? 'Needs your attention' : 'Everything looks clear', 'bell', alerts.length ? 'rose' : 'green')}</div>
    <div class="section-heading"><div><span class="eyebrow">Live production map</span><h2>Where material is right now</h2></div><button class="text-button" type="button" data-view="batches">View all batches ${icon('arrow')}</button></div>
    <div class="pipeline-grid">${stageCards}</div>
    <div class="dashboard-columns">
      <section class="panel attention-panel"><div class="panel-heading"><div><span class="eyebrow">Action queue</span><h2>Needs attention</h2></div><button class="icon-button small" type="button" data-view="alerts" aria-label="See all alerts">${icon('arrow')}</button></div>${attention || emptyState('check', 'No open alerts', 'Your stock and production dates look clear right now.')}</section>
      <section class="panel quick-panel"><div class="panel-heading"><div><span class="eyebrow">How it works</span><h2>One batch, one story</h2></div>${icon('route', 'panel-heading-icon')}</div><div class="story-list"><div class="story-row"><span class="story-number">01</span><div><strong>Create a batch</strong><p>Give the material a manual number and basic product details.</p></div></div><div class="story-row"><span class="story-number">02</span><div><strong>Move it through stages</strong><p>Record outside work, quantities, losses, exceptions, and quality.</p></div></div><div class="story-row"><span class="story-number">03</span><div><strong>Issue or return stock</strong><p>Know exactly which customer received which batch and how many pieces.</p></div></div></div><button class="learn-link" type="button" data-view="learn">Learn the vocabulary ${icon('arrow')}</button></section>
    </div>
    <section class="panel table-panel"><div class="panel-heading"><div><span class="eyebrow">Recently active</span><h2>Production batches</h2></div><button class="text-button" type="button" data-view="batches">Open batch list ${icon('arrow')}</button></div>${recent ? `<div class="table-scroll"><table><thead><tr><th>Batch</th><th>Product</th><th>Current stage</th><th>Expected</th><th>Status</th><th></th></tr></thead><tbody>${recent}</tbody></table></div>` : emptyState('layers', 'No active batches', 'Create your first batch to start the production map.')}</section>
    <div class="dashboard-footnote"><span>${icon('shield')} Quality snapshot: ${stats.pass} passed · ${stats.rework} rework · ${stats.reject} rejected</span><span>Local data saves automatically on this device.</span></div>
  </div>`;
}

function batchTableRow(batch, compact = false) {
  const product = getProduct(batch.productId);
  const expectedClass = batch.expectedDate && batch.expectedDate < todayISO() && !isBatchComplete(batch) ? 'date-late' : '';
  return `<tr data-action="open-batch" data-batch-id="${batch.id}" class="clickable-row"><td><strong class="batch-number">${escapeHtml(batch.batchNo)}</strong><small class="table-subtext">${escapeHtml(batch.color || product?.color || '')}</small></td><td><span>${escapeHtml(product?.name || 'Unknown product')}</span><small class="table-subtext">${escapeHtml(product?.size || '')}</small></td><td><span class="stage-pill"><span class="stage-pill-dot"></span>${escapeHtml(getStageLabel(batch))}</span></td><td class="${expectedClass}">${formatShortDate(batch.expectedDate)}</td><td>${statusBadge(batch.status, getBatchStatusLabel(batch))}</td><td class="table-action-cell">${!compact ? button('Open', `open-batch:${batch.id}`, 'quiet-small') : icon('arrow', 'row-arrow')}</td></tr>`;
}

function renderBatches() {
  const search = searchTerm.toLowerCase().trim();
  const filtered = appState.batches.filter((batch) => {
    const product = getProduct(batch.productId);
    const text = `${batch.batchNo} ${product?.name || ''} ${product?.size || ''} ${batch.color || ''}`.toLowerCase();
    const matchesSearch = !search || text.includes(search);
    const matchesStatus = batchFilters.status === 'all'
      || (batchFilters.status === 'active' && !isBatchComplete(batch))
      || (batchFilters.status === 'completed' && isBatchComplete(batch))
      || (batchFilters.status === 'exception' && batch.status === 'exception');
    const matchesStage = batchFilters.stage === 'all' || batch.currentStage === batchFilters.stage;
    return matchesSearch && matchesStatus && matchesStage;
  });
  const rows = filtered.map((batch) => batchTableRow(batch)).join('');
  return `<div class="standard-page">${pageHeading('Traceability', 'Production batches', 'Each batch keeps its material story from thread purchase to finished stock.', `${button(`${icon('plus')} New batch`, 'new-batch', 'primary')}${button(`${icon('box')} New product`, 'new-product', 'secondary')}`)}<section class="panel table-panel batch-list-panel"><div class="list-toolbar"><label class="search-box">${icon('search')}<input type="search" data-filter="search" value="${escapeHtml(searchTerm)}" placeholder="Search batch, product, or size" /></label><div class="filter-group"><select data-filter="status" aria-label="Filter by status"><option value="all" ${batchFilters.status === 'all' ? 'selected' : ''}>All statuses</option><option value="active" ${batchFilters.status === 'active' ? 'selected' : ''}>In production</option><option value="completed" ${batchFilters.status === 'completed' ? 'selected' : ''}>Completed</option><option value="exception" ${batchFilters.status === 'exception' ? 'selected' : ''}>Needs attention</option></select><select data-filter="stage" aria-label="Filter by stage"><option value="all">All stages</option>${DEFAULT_STAGES.map((stage) => `<option value="${stage.key}" ${batchFilters.stage === stage.key ? 'selected' : ''}>${escapeHtml(stage.label)}</option>`).join('')}</select>${icon('filter', 'filter-icon')}</div></div>${filtered.length ? `<div class="table-scroll"><table><thead><tr><th>Batch</th><th>Product</th><th>Current stage</th><th>Expected</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-footer"><span>Showing ${filtered.length} of ${appState.batches.length} batches</span><span>${icon('shield')} Manual batch numbers are unique</span></div>` : emptyState('search', 'No batches found', 'Try a different search or clear the filters.', `<button class="button button-secondary" type="button" data-action="clear-filters">Clear filters</button>`)}</section></div>`;
}

function renderBatchDetail() {
  const batch = getBatch(selectedBatchId);
  if (!batch) {
    currentView = 'batches';
    return renderBatches();
  }
  const product = getProduct(batch.productId);
  const currentStage = getCurrentStage(batch);
  const stageIndex = STAGE_INDEX[batch.currentStage] ?? 0;
  const timeline = DEFAULT_STAGES.map((definition, index) => {
    const stage = getStage(batch, definition.key) || makeStage(definition.key);
    const done = stage.status === 'completed';
    const active = index === stageIndex && !isBatchComplete(batch);
    const exception = ['exception', 'rejected', 'rework'].includes(stage.status);
    return `<div class="timeline-row ${done ? 'is-done' : ''} ${active ? 'is-current' : ''} ${exception ? 'has-exception' : ''}"><div class="timeline-marker">${done ? icon('check') : exception ? icon('warning') : `<span>${String(index + 1).padStart(2, '0')}</span>`}</div><div class="timeline-content"><div class="timeline-top"><div><strong>${escapeHtml(definition.label)}</strong>${definition.type === 'outside' ? '<span class="type-tag">Outside worker</span>' : ''}</div>${stageStatusBadge(stage.status)}</div><div class="timeline-meta">${stage.vendorId ? `<span>${icon('location')} ${escapeHtml(getVendor(stage.vendorId)?.name || 'Outside worker')}</span>` : ''}${stage.sentQty !== '' ? `<span>${icon('box')} Sent: ${escapeHtml(stage.sentQty)} pcs</span>` : ''}${stage.receivedQty !== '' ? `<span>${icon('check')} Received: ${escapeHtml(stage.receivedQty)} pcs</span>` : ''}${stage.lossQty ? `<span class="loss-text">${icon('warning')} Loss: ${escapeHtml(stage.lossQty)} pcs</span>` : ''}${stage.expectedDate ? `<span>${icon('clock')} Due ${formatShortDate(stage.expectedDate)}</span>` : ''}</div>${stage.notes ? `<p class="timeline-note">${escapeHtml(stage.notes)}</p>` : ''}${active ? `<button class="text-button timeline-action" type="button" data-action="update-stage" data-batch-id="${batch.id}" data-stage-key="${definition.key}">Update this stage ${icon('arrow')}</button>` : ''}</div></div>`;
  }).join('');
  const batchNotes = (appState.notes || []).filter((note) => note.batchId === batch.id);
  const records = batch.quality || [];
  const issues = batch.issues || [];
  return `<div class="standard-page detail-page"><div class="back-row"><button class="back-button" type="button" data-view="batches">${icon('back')} Back to batches</button><div class="detail-actions">${button(`${icon('note')} Add note`, 'note', 'secondary')}${button(`${icon('shield')} Record quality`, 'inspection', 'secondary')}${button(`${icon('route')} Update stage`, `update-stage:${batch.id}`, 'primary')}</div></div><div class="detail-heading"><div><span class="eyebrow">Production batch</span><h1>${escapeHtml(batch.batchNo)}</h1><p>${escapeHtml(product?.name || 'Unknown product')} · ${escapeHtml(product?.size || '')} · ${escapeHtml(batch.color || product?.color || '')}</p></div>${statusBadge(batch.status, getBatchStatusLabel(batch))}</div><div class="detail-summary-grid"><div class="summary-card"><span>Starting quantity</span><strong>${formatNumber(batch.initialPieces)} pcs</strong></div><div class="summary-card"><span>Thread recorded</span><strong>${formatKg(batch.threadKg)}</strong></div><div class="summary-card"><span>Finished / issued</span><strong>${formatNumber(batch.finishedPieces)} / ${formatNumber(batch.issuedPieces)}</strong></div><div class="summary-card"><span>Loss / rework</span><strong>${formatNumber(batch.lossPieces)} pcs</strong></div></div><div class="detail-grid"><section class="panel progress-panel"><div class="panel-heading"><div><span class="eyebrow">Traceability</span><h2>Production journey</h2></div><span class="stage-progress-label">${stageIndex + 1} of ${DEFAULT_STAGES.length}</span></div><div class="progress-bar"><span style="width:${Math.max(5, ((stageIndex + (isBatchComplete(batch) ? 1 : 0)) / DEFAULT_STAGES.length) * 100)}%"></span></div><div class="timeline">${timeline}</div></section><aside class="detail-aside"><section class="panel current-stage-card"><div class="panel-heading"><div><span class="eyebrow">Current focus</span><h2>${escapeHtml(currentStage?.label || 'Complete')}</h2></div>${icon(currentStage?.type === 'outside' ? 'route' : 'layers', 'panel-heading-icon')}</div><p>${currentStage?.type === 'outside' ? 'This material is expected to be handled by an outside worker.' : 'This step happens inside the shop.'}</p><div class="current-stage-detail"><span>Location</span><strong>${escapeHtml(getLocation(batch.locationId)?.name || 'Not set')}</strong><span>Expected date</span><strong>${formatDate(batch.expectedDate)}</strong></div><button class="button button-primary button-full" type="button" data-action="update-stage" data-batch-id="${batch.id}" data-stage-key="${batch.currentStage}">Update ${escapeHtml(currentStage?.shortLabel || 'stage')} ${icon('arrow')}</button></section><section class="panel notes-panel"><div class="panel-heading"><div><span class="eyebrow">Context</span><h2>Notes</h2></div><button class="icon-button small" type="button" data-action="note" aria-label="Add note">${icon('plus')}</button></div>${batchNotes.length ? `<div class="note-list">${batchNotes.map((note) => `<div class="note-item"><p>${escapeHtml(note.text)}</p><small>${escapeHtml(note.author || 'Employee')} · ${formatShortDate(note.createdAt)}</small></div>`).join('')}</div>` : '<p class="muted-copy">No notes yet. Add context so the next person knows what happened.</p>'}<form class="quick-note-form" data-form="quick-note" data-batch-id="${batch.id}"><textarea name="text" rows="2" placeholder="Add a quick note…" required></textarea><button class="button button-secondary button-small" type="submit">Save note</button></form></section></aside></div><section class="panel table-panel"><div class="panel-heading"><div><span class="eyebrow">Exceptions & quality</span><h2>Records for this batch</h2></div>${button(`${icon('plus')} Add quality result`, 'inspection', 'secondary')}</div><div class="record-columns"><div><h3>Quality results</h3>${records.length ? records.map((record) => `<div class="record-row"><span>${statusBadge(record.result, record.result === 'pass' ? 'Passed' : titleCase(record.result))}</span><div><strong>${escapeHtml(record.reason || 'No reason recorded')}</strong><small>${escapeHtml(record.notes || '')}</small></div><small>${escapeHtml(record.checkedBy || 'Unknown')} · ${formatShortDate(record.checkedAt)}</small></div>`).join('') : '<p class="muted-copy">No quality result recorded yet.</p>'}</div><div><h3>Customer issues</h3>${issues.length ? issues.map((issue) => `<div class="record-row"><span class="record-quantity">${formatNumber(issue.pieces)} pcs</span><div><strong>${escapeHtml(getCustomer(issue.customerId)?.name || 'Customer')}</strong><small>${escapeHtml(issue.note || 'Issued from finished stock')}</small></div><small>${formatShortDate(issue.date)}${issue.returnType ? ` · ${titleCase(issue.returnType)}` : ''}</small></div>`).join('') : '<p class="muted-copy">No customer issues recorded yet.</p>'}</div></div></section></div>`;
}

function renderInventory() {
  const threadRows = appState.threadStock.map((item) => {
    const isLow = Number(item.quantityKg) <= Number(item.minKg || appState.settings.lowStockKg);
    return `<tr><td><strong>${escapeHtml(item.name)}</strong><small class="table-subtext">${escapeHtml(item.color || '')}</small></td><td>${escapeHtml(getLocation(item.locationId)?.name || 'Unassigned')}</td><td><strong>${formatKg(item.quantityKg)}</strong></td><td>${formatKg(item.minKg || appState.settings.lowStockKg)}</td><td>${isLow ? statusBadge('low', 'Low stock') : statusBadge('available', 'Healthy')}</td><td class="table-action-cell">${button('Receive', 'receive-thread', 'quiet-small', `data-thread-id="${item.id}"`)}</td></tr>`;
  }).join('');
  const finishedBatches = appState.batches.filter((batch) => getBatchAvailable(batch) > 0 || batch.finishedPieces > 0);
  const finishedRows = finishedBatches.map((batch) => {
    const product = getProduct(batch.productId);
    return `<tr data-action="open-batch" data-batch-id="${batch.id}" class="clickable-row"><td><strong class="batch-number">${escapeHtml(batch.batchNo)}</strong><small class="table-subtext">${escapeHtml(batch.color || product?.color || '')}</small></td><td>${escapeHtml(product?.name || 'Unknown product')} · ${escapeHtml(product?.size || '')}</td><td>${formatNumber(batch.finishedPieces)}</td><td class="available-quantity">${formatNumber(getBatchAvailable(batch))}</td><td>${formatNumber(batch.issuedPieces)}</td><td>${getBatchAvailable(batch) > 0 ? button('Issue', 'issue-stock', 'quiet-small', `data-batch-id="${batch.id}"`) : '<span class="muted-copy">None left</span>'}</td></tr>`;
  }).join('');
  const movementRows = appState.movements.slice(0, 12).map((movement) => `<tr><td>${movement.type === 'in' ? '<span class="movement-in">IN</span>' : '<span class="movement-out">OUT</span>'}</td><td><strong>${escapeHtml(movement.item || movement.batchId || 'Stock movement')}</strong><small class="table-subtext">${escapeHtml(movement.note || '')}</small></td><td>${formatNumber(movement.quantity, movement.unit === 'kg' ? 1 : 0)} ${escapeHtml(movement.unit || 'pcs')}</td><td>${escapeHtml(getLocation(movement.locationId)?.name || '—')}</td><td>${formatShortDate(movement.at)}</td><td>${escapeHtml(movement.actor || '')}</td></tr>`).join('');
  let content = '';
  if (inventoryTab === 'thread') {
    content = `<section class="panel table-panel"><div class="panel-heading"><div><span class="eyebrow">Raw material</span><h2>Thread stock</h2></div>${button(`${icon('plus')} Receive thread`, 'receive-thread', 'primary')}</div>${appState.threadStock.length ? `<div class="table-scroll"><table><thead><tr><th>Thread lot</th><th>Location</th><th>Available</th><th>Alert level</th><th>Status</th><th></th></tr></thead><tbody>${threadRows}</tbody></table></div>` : emptyState('box', 'No thread stock', 'Receive a thread lot to begin tracking material.')}</section>`;
  } else if (inventoryTab === 'finished') {
    content = `<section class="panel table-panel"><div class="panel-heading"><div><span class="eyebrow">Completed material</span><h2>Finished stock</h2></div>${button(`${icon('users')} Issue to customer`, 'issue-stock', 'primary')}</div>${finishedBatches.length ? `<div class="table-scroll"><table><thead><tr><th>Batch</th><th>Product</th><th>Finished</th><th>Available</th><th>Issued</th><th></th></tr></thead><tbody>${finishedRows}</tbody></table></div>` : emptyState('sparkle', 'No finished stock yet', 'Complete a batch through packing to make it available here.')}</section>`;
  } else {
    content = `<section class="panel table-panel"><div class="panel-heading"><div><span class="eyebrow">Audit trail</span><h2>Stock movements</h2></div><span class="muted-copy">Latest 12 movements</span></div>${appState.movements.length ? `<div class="table-scroll"><table><thead><tr><th>Type</th><th>Item</th><th>Quantity</th><th>Location</th><th>Date</th><th>By</th></tr></thead><tbody>${movementRows}</tbody></table></div>` : emptyState('route', 'No movements yet', 'Receiving or issuing stock will create a movement here.')}</section>`;
  }
  return `<div class="standard-page">${pageHeading('Material control', 'Stock & inventory', 'See what is available, what is outside, and which pieces are ready for a customer.', `${button(`${icon('download')} Export backup`, 'export-backup', 'secondary')}`)}<div class="tab-bar">${[['thread', 'Thread stock', 'box'], ['finished', 'Finished stock', 'sparkle'], ['movements', 'Movement history', 'route']].map(([key, label, iconName]) => `<button class="tab-button ${inventoryTab === key ? 'is-active' : ''}" type="button" data-action="inventory-tab" data-tab="${key}">${icon(iconName)} ${escapeHtml(label)}</button>`).join('')}</div>${content}</div>`;
}

function renderOutside() {
  const jobs = [];
  appState.batches.forEach((batch) => {
    batch.stages.forEach((stage) => {
      if (stage.type === 'outside' && stage.status !== 'pending' && stage.status !== 'completed') {
        const due = stage.expectedDate || batch.expectedDate;
        const overdue = due && due < todayISO();
        jobs.push({ batch, stage, vendor: getVendor(stage.vendorId), overdue });
      }
    });
  });
  const jobCards = jobs.map(({ batch, stage, vendor, overdue }) => `<article class="outside-card ${overdue ? 'job-overdue' : ''}"><div class="outside-card-top"><div><span class="eyebrow">${escapeHtml(stage.label)}</span><h3>${escapeHtml(batch.batchNo)}</h3><p>${escapeHtml(getProduct(batch.productId)?.name || 'Product')} · ${formatNumber(batch.initialPieces)} pcs</p></div>${overdue ? statusBadge('overdue', 'Overdue') : statusBadge(stage.status, 'In progress')}</div><div class="outside-vendor"><span class="vendor-avatar">${icon('factory')}</span><div><strong>${escapeHtml(vendor?.name || 'Outside worker not assigned')}</strong><small>Due ${formatDate(stage.expectedDate || batch.expectedDate)}</small></div></div><div class="outside-card-footer"><span>${icon('box')} Sent ${formatNumber(stage.sentQty || batch.initialPieces)} pcs</span><button class="button button-secondary button-small" type="button" data-action="update-stage" data-batch-id="${batch.id}" data-stage-key="${stage.key}">Update job</button></div></article>`).join('');
  return `<div class="standard-page">${pageHeading('Subcontracted work', 'Outside work', 'Track what left the shop, who has it, and when it is expected back.', `${button(`${icon('plus')} Add outside worker`, 'new-vendor', 'secondary')}`)}<div class="outside-summary"><div class="outside-summary-card"><span class="summary-icon">${icon('route')}</span><div><strong>${jobs.length}</strong><span>active jobs</span></div></div><div class="outside-summary-card"><span class="summary-icon">${icon('clock')}</span><div><strong>${jobs.filter((job) => job.overdue).length}</strong><span>past expected date</span></div></div><div class="outside-summary-card"><span class="summary-icon">${icon('location')}</span><div><strong>${appState.locations.filter((location) => location.type === 'outside').length}</strong><span>outside locations</span></div></div></div><div class="outside-grid">${jobCards || emptyState('route', 'No active outside jobs', 'Update a batch stage to send material to an outside worker.')}</div></div>`;
}

function renderQuality() {
  const stats = qualityStats();
  const pending = appState.batches.filter((batch) => batch.currentStage === 'inspection');
  const records = qualityRecords().slice().sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt)));
  const recordRows = records.map((record) => { const batch = getBatch(record.batchId); return `<tr><td><strong>${escapeHtml(batch?.batchNo || 'Unknown batch')}</strong><small class="table-subtext">${escapeHtml(getProduct(batch?.productId)?.name || '')}</small></td><td>${statusBadge(record.result, record.result === 'pass' ? 'Passed' : titleCase(record.result))}</td><td>${escapeHtml(record.reason || '—')}</td><td>${escapeHtml(record.notes || '—')}</td><td>${escapeHtml(record.checkedBy || '—')}</td><td>${formatShortDate(record.checkedAt)}</td></tr>`; }).join('');
  return `<div class="standard-page">${pageHeading('Quality control', 'Quality control', 'Keep pass, rework, and reject decisions visible without adding financial complexity.', `${button(`${icon('plus')} Record result`, 'inspection', 'primary')}`)}<div class="metric-grid quality-metrics">${metricCard('Passed', formatNumber(stats.pass), 'Accepted after check', 'check', 'green')}${metricCard('Rework', formatNumber(stats.rework), 'Needs another pass', 'refresh', 'gold')}${metricCard('Rejected', formatNumber(stats.reject), 'Removed or unusable', 'warning', 'rose')}${metricCard('Awaiting check', formatNumber(pending.length), 'At inspection stage', 'shield', 'blue')}</div><section class="panel table-panel"><div class="panel-heading"><div><span class="eyebrow">Queue</span><h2>Batches waiting for inspection</h2></div>${pending.length ? `<span class="count-chip">${pending.length} open</span>` : ''}</div>${pending.length ? `<div class="pending-quality-grid">${pending.map((batch) => `<button class="pending-quality-card" type="button" data-action="open-batch" data-batch-id="${batch.id}"><span class="pending-quality-icon">${icon('shield')}</span><span><strong>${escapeHtml(batch.batchNo)}</strong><small>${escapeHtml(getProduct(batch.productId)?.name || '')} · ${formatNumber(batch.initialPieces)} pcs</small></span>${icon('arrow')}</button>`).join('')}</div>` : emptyState('check', 'Inspection queue is clear', 'Batches will appear here when they reach the quality stage.')}</section><section class="panel table-panel"><div class="panel-heading"><div><span class="eyebrow">History</span><h2>Quality results</h2></div></div>${recordRows ? `<div class="table-scroll"><table><thead><tr><th>Batch</th><th>Result</th><th>Reason</th><th>Notes</th><th>Checked by</th><th>Date</th></tr></thead><tbody>${recordRows}</tbody></table></div>` : emptyState('shield', 'No quality results', 'Record the first inspection result to start the quality history.')}</section></div>`;
}

function renderCustomers() {
  const issues = appState.batches.flatMap((batch) => (batch.issues || []).map((issue) => ({ ...issue, batch }))).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const issueRows = issues.map(({ batch, ...issue }) => `<tr><td><strong>${escapeHtml(getCustomer(issue.customerId)?.name || 'Unknown customer')}</strong><small class="table-subtext">${escapeHtml(getCustomer(issue.customerId)?.phone || '')}</small></td><td><strong>${escapeHtml(batch.batchNo)}</strong><small class="table-subtext">${escapeHtml(getProduct(batch.productId)?.name || '')}</small></td><td>${formatNumber(issue.pieces)} pcs</td><td>${issue.returnType ? statusBadge(issue.returnType, titleCase(issue.returnType)) : statusBadge('available', 'Issued')}</td><td>${formatShortDate(issue.date)}</td><td class="table-action-cell">${button(issue.returnType ? 'View' : 'Return / replace', issue.returnType ? `open-batch:${batch.id}` : 'return-stock', 'quiet-small', `data-issue-id="${issue.id}" data-batch-id="${batch.id}"`)}</td></tr>`).join('');
  return `<div class="standard-page">${pageHeading('Finished stock movement', 'Customers & issues', 'Record which customer received which batch, then track returns or replacements.', `${button(`${icon('plus')} Add customer`, 'new-customer', 'secondary')}${button(`${icon('users')} Issue stock`, 'issue-stock', 'primary')}`)}<div class="customer-layout"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">Customer directory</span><h2>Customers</h2></div><span class="count-chip">${appState.customers.length}</span></div><div class="customer-grid">${appState.customers.map((customer) => `<article class="customer-card"><span class="avatar avatar-large">${initials(customer.name)}</span><div><strong>${escapeHtml(customer.name)}</strong><span>${escapeHtml(customer.phone || 'No phone saved')}</span><small>${escapeHtml(customer.address || 'Address not saved')}</small></div><button class="icon-button small" type="button" data-action="issue-to-customer" data-customer-id="${customer.id}" aria-label="Issue stock to ${escapeHtml(customer.name)}">${icon('plus')}</button></article>`).join('')}</div>${!appState.customers.length ? emptyState('users', 'No customers yet', 'Add a customer before issuing finished stock.') : ''}</section><section class="panel table-panel"><div class="panel-heading"><div><span class="eyebrow">Stock out / return log</span><h2>Customer issue history</h2></div></div>${issueRows ? `<div class="table-scroll"><table><thead><tr><th>Customer</th><th>Batch</th><th>Quantity</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>${issueRows}</tbody></table></div>` : emptyState('users', 'No issues recorded', 'Finished pieces issued to customers will appear here.')}</section></div></div>`;
}

function renderNotes() {
  const allNotes = (appState.notes || []).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const noteCards = allNotes.map((note) => { const batch = getBatch(note.batchId); return `<article class="note-card"><div class="note-card-top"><span class="note-author-avatar">${initials(note.author)}</span><div><strong>${escapeHtml(note.author || 'Employee')}</strong><small>${batch ? escapeHtml(batch.batchNo) : 'General note'} · ${formatShortDate(note.createdAt)}</small></div><span class="note-type">${note.batchId ? 'Batch note' : 'General'}</span></div><p>${escapeHtml(note.text)}</p>${batch ? `<button class="text-button" type="button" data-action="open-batch" data-batch-id="${batch.id}">Open ${escapeHtml(batch.batchNo)} ${icon('arrow')}</button>` : ''}</article>`; }).join('');
  return `<div class="standard-page">${pageHeading('Context and decisions', 'Notes & decisions', 'Free-form notes are attached to a batch so important context is not lost between employees.', `${button(`${icon('plus')} Add note`, 'note', 'primary')}`)}<div class="notes-layout"><section class="panel quick-note-large"><div class="panel-heading"><div><span class="eyebrow">Write it down</span><h2>Add a note</h2></div>${icon('note', 'panel-heading-icon')}</div><form data-form="global-note"><label class="field-label">Related batch <span class="optional">Optional</span></label><select name="batchId"><option value="">General company note</option>${appState.batches.map((batch) => `<option value="${batch.id}">${escapeHtml(batch.batchNo)} · ${escapeHtml(getProduct(batch.productId)?.name || '')}</option>`).join('')}</select><label class="field-label">What should the next person know?</label><textarea name="text" rows="5" placeholder="For example: shade approved, extra protection needed, weaver requested a different count…" required></textarea><div class="form-actions"><span class="muted-copy">Saved offline on this device.</span><button class="button button-primary" type="submit">Save note ${icon('arrow')}</button></div></form></section><section class="notes-feed"><div class="section-heading compact-heading"><div><span class="eyebrow">Shared memory</span><h2>Recent notes</h2></div><span class="count-chip">${allNotes.length}</span></div>${noteCards || emptyState('note', 'No notes yet', 'Add the first note to keep the business history clear.')}</section></div></div>`;
}

function renderAlerts() {
  const alerts = getOpenAlerts();
  const resolved = appState.notifications.filter((item) => item.resolved);
  const alertCard = (alert) => `<article class="alert-card ${alert.read ? 'is-read' : ''} ${alert.resolved ? 'is-resolved' : ''}"><span class="alert-card-icon alert-${escapeHtml(alert.type)}">${icon(alert.type === 'low-stock' ? 'box' : alert.type === 'quality' ? 'shield' : alert.type === 'customer' ? 'users' : 'clock')}</span><div class="alert-card-copy"><div class="alert-card-title"><strong>${escapeHtml(alert.title)}</strong>${!alert.read ? '<span class="unread-dot"></span>' : ''}</div><p>${escapeHtml(alert.message)}</p><small>${escapeHtml(alert.type === 'low-stock' ? 'Inventory' : titleCase(alert.type))} · ${formatShortDate(alert.createdAt)}</small></div><div class="alert-card-actions">${!alert.resolved ? button(alert.read ? 'Mark unread' : 'Mark read', `toggle-alert:${alert.id}`, 'quiet-small') : ''}${alert.relatedId ? button('Open', `open-alert-related:${alert.relatedId}`, 'quiet-small') : ''}</div></article>`;
  return `<div class="standard-page">${pageHeading('Stay ahead', 'Alerts', 'In-app reminders for low stock, production dates, quality, and customer follow-up.', `${button(`${icon('check')} Mark all read`, 'mark-all-alerts', 'secondary')}`)}<div class="alert-summary"><div><strong>${alerts.length}</strong><span>open alerts</span></div><div><strong>${alerts.filter((alert) => alert.type === 'low-stock').length}</strong><span>stock alerts</span></div><div><strong>${alerts.filter((alert) => ['deadline', 'customer'].includes(alert.type)).length}</strong><span>date alerts</span></div><div><strong>${resolved.length}</strong><span>resolved</span></div></div><section class="alert-list">${alerts.map(alertCard).join('') || emptyState('check', 'All clear', 'There are no active alerts right now.')}</section>${resolved.length ? `<details class="resolved-alerts"><summary>View resolved alerts (${resolved.length})</summary>${resolved.slice(0, 20).map(alertCard).join('')}</details>` : ''}</div>`;
}

function renderLearn() {
  const glossary = [
    ['Dashboard', 'The overview screen. It answers: “What needs my attention today?”', 'dashboard'],
    ['Batch / lot', 'One traceable group of material with its own number and production story.', 'layers'],
    ['Stage', 'A step in the production journey, such as weaving or dyeing.', 'route'],
    ['Stock', 'Material that is available, in progress, outside, or already issued.', 'box'],
    ['Quality result', 'The decision after inspection: pass, rework, or reject.', 'shield'],
    ['Wastage / loss', 'Material lost during cutting, carbonization, dyeing, or inspection.', 'warning'],
    ['Offline-first', 'The app saves on the device first and syncs later when online.', 'download'],
    ['API', 'A defined way for the app to ask a server to save or fetch data.', 'layers'],
  ];
  return `<div class="standard-page learn-page">${pageHeading('Build your vocabulary', 'Learn the system', 'You do not need to know coding to use this app. These words will help you talk to a developer and understand how the project works.', `${button(`${icon('book')} Open learning guide`, 'open-learning-guide', 'secondary')}`)}<section class="learn-hero"><div class="learn-hero-icon">${icon('sparkle')}</div><div><span class="eyebrow light-eyebrow">The short version</span><h2>Frontend + offline database + sync = a useful field app</h2><p>The screens you see are the <strong>frontend</strong>. Changes are saved in the browser first. When you press Sync, a <strong>backend</strong> shares them with other devices. A <strong>database</strong> keeps the records organized.</p></div></section><div class="glossary-grid">${glossary.map(([term, definition, iconName]) => `<article class="glossary-card"><span class="glossary-icon">${icon(iconName)}</span><h3>${escapeHtml(term)}</h3><p>${escapeHtml(definition)}</p></article>`).join('')}</div><div class="learn-columns"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">Data journey</span><h2>What happens when you save?</h2></div>${icon('route', 'panel-heading-icon')}</div><ol class="step-list"><li><span>01</span><div><strong>Click Save</strong><p>Your action is caught by a <em>form event listener</em>.</p></div></li><li><span>02</span><div><strong>Validate</strong><p>The app checks that required values make sense.</p></div></li><li><span>03</span><div><strong>Save locally</strong><p><code>db.js</code> writes the record to IndexedDB.</p></div></li><li><span>04</span><div><strong>Sync later</strong><p><code>sync.js</code> sends the document to the API when online.</p></div></li></ol></section><section class="panel"><div class="panel-heading"><div><span class="eyebrow">Your first project files</span><h2>Where to look in the code</h2></div>${icon('layers', 'panel-heading-icon')}</div><div class="file-list"><button type="button" data-action="show-file" data-file="index.html"><span class="file-icon">HTML</span><span><strong>index.html</strong><small>The structure of every screen</small></span>${icon('arrow')}</button><button type="button" data-action="show-file" data-file="app.js"><span class="file-icon file-js">JS</span><span><strong>app.js</strong><small>Buttons, forms, calculations, and rendering</small></span>${icon('arrow')}</button><button type="button" data-action="show-file" data-file="db.js"><span class="file-icon file-db">DB</span><span><strong>db.js</strong><small>Offline storage</small></span>${icon('arrow')}</button><button type="button" data-action="show-file" data-file="styles.css"><span class="file-icon file-css">CSS</span><span><strong>styles.css</strong><small>Colors, layout, cards, and mobile design</small></span>${icon('arrow')}</button></div></section></div><section class="panel roadmap-panel"><div class="panel-heading"><div><span class="eyebrow">Building in phases</span><h2>What comes next</h2></div>${icon('route', 'panel-heading-icon')}</div><div class="roadmap"><div class="roadmap-step is-current"><span>Now</span><strong>Local workflow</strong><p>Learn the screens and record your real process.</p></div><div class="roadmap-step"><span>Next</span><strong>Secure sync</strong><p>Add real accounts, company access, and conflict review.</p></div><div class="roadmap-step"><span>Later</span><strong>More branches</strong><p>Add location-level permissions and consolidated reports.</p></div><div class="roadmap-step"><span>Whenever</span><strong>Finance</strong><p>Only add money features if you explicitly need them.</p></div></div></section></div>`;
}

function renderSettings() {
  const fieldRows = appState.customFields.map((field) => `<div class="setting-row"><div><strong>${escapeHtml(field.label)}</strong><span>${escapeHtml(titleCase(field.type))} field</span></div><button class="icon-button danger-text small" type="button" data-action="delete-field" data-field-id="${field.id}" aria-label="Delete ${escapeHtml(field.label)}">${icon('close')}</button></div>`).join('');
  const userRows = appState.users.filter((user) => user.active).map((user) => `<div class="setting-row"><div class="user-setting"><span class="avatar avatar-small">${initials(user.name)}</span><div><strong>${escapeHtml(user.name)}</strong><span>${user.role === 'owner' ? 'Owner access' : 'Employee access'}</span></div></div>${user.role === 'owner' ? statusBadge('available', 'Full access') : statusBadge('progress', 'Can update work')}</div>`).join('');
  return `<div class="standard-page">${pageHeading('Workspace control', 'Settings', 'Shape the app around your operation. These settings do not add accounting features.', '')}<div class="settings-grid"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">Product catalog</span><h2>Custom product fields</h2></div>${icon('box', 'panel-heading-icon')}</div><p class="panel-intro">Add a field such as grade, count, GSM, or width. It will appear when you create a product.</p>${fieldRows || '<p class="muted-copy">No custom fields added yet.</p>'}<form class="inline-form" data-form="custom-field"><input name="label" placeholder="Field name, e.g. GSM" required /><select name="type"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option></select><button class="button button-primary button-small" type="submit">Add field</button></form></section><section class="panel"><div class="panel-heading"><div><span class="eyebrow">Alert rules</span><h2>Keep notifications useful</h2></div>${icon('bell', 'panel-heading-icon')}</div><p class="panel-intro">Alerts are shown inside the app so you can decide which events deserve attention.</p><form class="settings-form" data-form="settings"><label class="field-label">Default low-stock level (kg)</label><input name="lowStockKg" type="number" min="0" step="0.1" value="${escapeHtml(appState.settings.lowStockKg)}" /><label class="field-label">Days before a deadline to warn</label><input name="alertLeadDays" type="number" min="0" max="30" value="${escapeHtml(appState.settings.alertLeadDays)}" /><div class="form-actions"><span class="muted-copy">Changes apply to future and existing alerts.</span><button class="button button-primary button-small" type="submit">Save settings</button></div></form></section><section class="panel"><div class="panel-heading"><div><span class="eyebrow">People</span><h2>Owner and employees</h2></div>${icon('users', 'panel-heading-icon')}</div><p class="panel-intro">This prototype uses a shared employee login with a name selector. Individual secure PINs can be added when the app is hosted.</p>${userRows}<form class="inline-form" data-form="new-user"><input name="name" placeholder="Employee name" required /><button class="button button-secondary button-small" type="submit">Add employee</button></form></section><section class="panel backup-panel"><div class="panel-heading"><div><span class="eyebrow">Data safety</span><h2>Offline backup</h2></div>${icon('shield', 'panel-heading-icon')}</div><p class="panel-intro">Export a readable JSON backup before clearing browser data or changing devices. JSON is a plain-text data format used for backups and migration.</p><div class="backup-actions">${button(`${icon('download')} Download backup`, 'export-backup', 'primary')}<label class="button button-secondary file-button">${icon('upload')} Import backup<input type="file" accept="application/json" data-import-backup /></label>${button('Reset sample data', 'reset-data', 'danger')}</div><div class="sync-explainer"><span class="status-dot"></span><div><strong>Current mode: ${navigator.onLine ? 'online, local-first' : 'offline'}</strong><p>Press Sync to try the optional development server. If it is not connected, your data still remains safe on this device.</p></div></div></section></div></div>`;
}

// -----------------------------------------------------------------------------
// Modal templates
// -----------------------------------------------------------------------------

function modalShell(title, subtitle, body, size = '') {
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal ${size ? `modal-${size}` : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-panel><div class="modal-header"><div><span class="eyebrow">146enterprises</span><h2 id="modal-title">${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div><button class="icon-button" type="button" data-action="close-modal" aria-label="Close">${icon('close')}</button></div>${body}</section></div>`;
}

function renderModal() {
  const root = document.querySelector('#modal-root');
  if (!modalState) {
    root.innerHTML = '';
    return;
  }
  const { type, data = {} } = modalState;
  let html = '';
  if (type === 'new-batch') {
    html = modalShell('Create a production batch', 'Use a manual number your team already understands.', `<form class="modal-form" data-form="new-batch"><div class="form-grid"><label class="field-label">Batch number <span class="required">Required</span><input name="batchNo" placeholder="PASH-26005" required /></label><label class="field-label">Product <span class="required">Required</span><select name="productId" required>${selectOptions(appState.products, '', 'id', 'name', 'Choose a product')}</select></label><label class="field-label">Thread quantity (kg)<input name="threadKg" type="number" min="0" step="0.1" placeholder="0" required /></label><label class="field-label">Starting pieces<input name="initialPieces" type="number" min="1" step="1" placeholder="0" required /></label><label class="field-label">Use thread lot <span class="optional">Optional</span><select name="threadItemId"><option value="">Do not deduct from a lot</option>${appState.threadStock.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} · ${formatKg(item.quantityKg)}</option>`).join('')}</select></label><label class="field-label">Expected completion date<input name="expectedDate" type="date" value="${dateFromToday(7)}" /></label><label class="field-label">Current location<select name="locationId">${selectOptions(appState.locations, 'loc-shop')}</select></label><label class="field-label full-field">Opening note <span class="optional">Optional</span><textarea name="notes" rows="3" placeholder="Anything the next person should know…"></textarea></label></div><div class="modal-footer"><span class="muted-copy">A batch number becomes the permanent trace key.</span><div><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Create batch ${icon('arrow')}</button></div></div></form>`);
  } else if (type === 'new-product') {
    const customFields = appState.customFields.map((field) => `<label class="field-label">${escapeHtml(field.label)}<input name="custom_${escapeHtml(field.id)}" type="${field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}" /></label>`).join('');
    html = modalShell('Add a product', 'Create the item that batches and finished stock will refer to.', `<form class="modal-form" data-form="new-product"><div class="form-grid"><label class="field-label">Category<select name="category"><option>Pashmina</option><option>Stole</option><option>Lohi</option><option>Other</option></select></label><label class="field-label">Product name<input name="name" placeholder="Fine-wool pashmina" required /></label><label class="field-label">Size format<input name="size" placeholder="28 × 80" required /></label><label class="field-label">Weight per piece (kg)<input name="weightPerPiece" type="number" min="0" step="0.01" placeholder="0.00" required /></label><label class="field-label">Fabric type<input name="fabricType" placeholder="Fine wool" required /></label><label class="field-label">Style variant<input name="style" placeholder="Plain, printed, checked…" /></label><label class="field-label full-field">Color<input name="color" placeholder="Ivory" required /></label>${customFields}</div><div class="modal-footer"><span class="muted-copy">You can add more fields in Settings.</span><div><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Add product ${icon('arrow')}</button></div></div></form>`);
  } else if (type === 'update-stage') {
    const batch = getBatch(data.batchId);
    if (!batch) return '';
    const stageKey = data.stageKey || batch.currentStage;
    const stage = getStage(batch, stageKey) || makeStage(stageKey);
    const definition = STAGE_BY_KEY[stageKey];
    const isOutside = definition.type === 'outside';
    const isInspection = stageKey === 'inspection';
    const statusOptions = isInspection
      ? [['in_progress', 'Still inspecting'], ['rework', 'Needs rework'], ['rejected', 'Reject this batch'], ['completed', 'Pass inspection']]
      : isOutside
        ? [['sent', 'Sent to outside worker'], ['in_progress', 'Work in progress'], ['completed', 'Received / completed'], ['exception', 'Exception or delay']]
        : [['in_progress', 'In progress'], ['completed', 'Completed'], ['exception', 'Exception or delay']];
    html = modalShell(`Update ${definition.label}`, `${batch.batchNo} · use the received quantity to make losses visible.`, `<form class="modal-form" data-form="update-stage"><input type="hidden" name="batchId" value="${batch.id}" /><input type="hidden" name="stageKey" value="${stageKey}" /><div class="form-grid"><label class="field-label">Stage<select name="status">${statusOptions.map(([value, label]) => `<option value="${value}" ${stage.status === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>${isOutside ? `<label class="field-label">Outside worker<select name="vendorId">${selectOptions(appState.vendors, stage.vendorId, 'id', 'name', 'Choose worker')}</select></label>` : ''}<label class="field-label">Sent quantity (pcs)<input name="sentQty" type="number" min="0" step="1" value="${escapeHtml(stage.sentQty || batch.initialPieces)}" /></label><label class="field-label">Received quantity (pcs)<input name="receivedQty" type="number" min="0" step="1" value="${escapeHtml(stage.receivedQty || '')}" /></label><label class="field-label">Loss this stage (pcs)<input name="lossQty" type="number" min="0" step="1" value="${escapeHtml(stage.lossQty || 0)}" /></label><label class="field-label">Expected return date<input name="expectedDate" type="date" value="${escapeHtml(stage.expectedDate || batch.expectedDate || '')}" /></label><label class="field-label full-field">Reason / note<textarea name="notes" rows="3" placeholder="Explain a delay, quantity difference, or decision…">${escapeHtml(stage.notes || '')}</textarea></label></div>${isInspection ? '<div class="form-tip">For a formal pass, rework, or reject result, use “Record quality” so the quality history is updated too.</div>' : ''}<div class="modal-footer"><span class="muted-copy">Changes are saved offline and can be synced later.</span><div><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Save stage ${icon('arrow')}</button></div></div></form>`);
  } else if (type === 'receive-thread') {
    const selectedThread = data.threadItemId || appState.threadStock[0]?.id || '';
    html = modalShell('Receive thread stock', 'Add material that arrived at the main shop.', `<form class="modal-form" data-form="receive-thread"><div class="form-grid"><label class="field-label">Thread lot<select name="threadItemId" required>${selectOptions(appState.threadStock, selectedThread, 'id', 'name', 'Choose a thread lot')}</select></label><label class="field-label">Quantity received (kg)<input name="quantityKg" type="number" min="0.1" step="0.1" placeholder="0" required /></label><label class="field-label">Location<select name="locationId">${selectOptions(appState.locations.filter((location) => location.type === 'internal'), 'loc-shop')}</select></label><label class="field-label full-field">Note <span class="optional">Optional</span><textarea name="note" rows="3" placeholder="Supplier, lot reference, or condition…"></textarea></label></div><div class="modal-footer"><span class="muted-copy">A movement will be added to the stock history.</span><div><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Receive stock ${icon('arrow')}</button></div></div></form>`);
  } else if (type === 'issue-stock') {
    const customerId = data.customerId || '';
    const batchId = data.batchId || appState.batches.find((batch) => getBatchAvailable(batch) > 0)?.id || '';
    const availableBatches = appState.batches.filter((batch) => getBatchAvailable(batch) > 0);
    html = modalShell('Issue finished stock', 'Track exactly which batch and pieces went to a customer.', `<form class="modal-form" data-form="issue-stock"><div class="form-grid"><label class="field-label">Customer<select name="customerId" required>${selectOptions(appState.customers, customerId, 'id', 'name', 'Choose customer')}</select></label><label class="field-label">Batch<select name="batchId" required>${selectOptions(availableBatches, batchId, 'id', 'batchNo', 'Choose finished batch')}</select></label><label class="field-label">Pieces issued<input name="pieces" type="number" min="1" step="1" placeholder="1" required /></label><label class="field-label">Promised date <span class="optional">Optional</span><input name="promisedDate" type="date" value="${dateFromToday(2)}" /></label><label class="field-label full-field">Note <span class="optional">Optional</span><textarea name="note" rows="3" placeholder="Picked up, delivery note, or special request…"></textarea></label></div><div class="modal-footer"><span class="muted-copy">Available pieces will be reduced immediately.</span><div><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Issue pieces ${icon('arrow')}</button></div></div></form>`);
  } else if (type === 'return-stock') {
    const issues = appState.batches.flatMap((batch) => (batch.issues || []).filter((issue) => !issue.returnType).map((issue) => ({ ...issue, batch, batchNo: batch.batchNo, label: `${getCustomer(issue.customerId)?.name || 'Customer'} · ${batch.batchNo} · ${formatNumber(issue.pieces)} pcs` })));
    html = modalShell('Return or replace pieces', 'Close the loop when a customer sends material back or needs a replacement.', `<form class="modal-form" data-form="return-stock"><div class="form-grid"><label class="field-label">Original customer issue<select name="issueId" required>${selectOptions(issues, data.issueId, 'id', 'label', 'Choose an issue')}</select></label><label class="field-label">Action<select name="returnType"><option value="return">Returned to stock</option><option value="replacement">Replacement sent</option></select></label><label class="field-label">Quantity<input name="pieces" type="number" min="1" step="1" placeholder="1" required /></label><label class="field-label full-field">Reason / note<textarea name="reason" rows="3" placeholder="Describe the reason for the return or replacement…"></textarea></label></div><div class="modal-footer"><span class="muted-copy">This will update the batch’s available quantity.</span><div><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Save return ${icon('arrow')}</button></div></div></form>`);
  } else if (type === 'inspection') {
    const inspectionBatches = appState.batches.filter((batch) => batch.currentStage === 'inspection' || getBatchAvailable(batch) > 0);
    html = modalShell('Record quality result', 'A simple pass, rework, or reject decision with a reason.', `<form class="modal-form" data-form="inspection"><div class="form-grid"><label class="field-label">Batch<select name="batchId" required>${selectOptions(inspectionBatches, data.batchId || inspectionBatches[0]?.id, 'id', 'batchNo', 'Choose batch')}</select></label><label class="field-label">Result<select name="result" required><option value="pass">Pass</option><option value="rework">Rework</option><option value="reject">Reject</option></select></label><label class="field-label full-field">Reason<textarea name="reason" rows="3" placeholder="e.g. shade, softness, density, measurement, or defect…" required></textarea></label><label class="field-label full-field">Additional notes <span class="optional">Optional</span><textarea name="notes" rows="2" placeholder="What did the next person need to know?"></textarea></label></div><div class="modal-footer"><span class="muted-copy">The result appears in Quality control analytics.</span><div><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Save result ${icon('arrow')}</button></div></div></form>`);
  } else if (type === 'note') {
    const batches = appState.batches;
    html = modalShell('Add an operational note', 'Notes are free-form and can be attached to a batch.', `<form class="modal-form" data-form="note"><div class="form-grid"><label class="field-label">Related batch <span class="optional">Optional</span><select name="batchId"><option value="">General company note</option>${batches.map((batch) => `<option value="${batch.id}" ${batch.id === data.batchId ? 'selected' : ''}>${escapeHtml(batch.batchNo)} · ${escapeHtml(getProduct(batch.productId)?.name || '')}</option>`).join('')}</select></label><label class="field-label full-field">Note<textarea name="text" rows="5" placeholder="Write the decision or context… " required></textarea></label></div><div class="modal-footer"><span class="muted-copy">It will be visible in Notes & decisions.</span><div><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Save note ${icon('arrow')}</button></div></div></form>`);
  } else if (type === 'new-customer') {
    html = modalShell('Add a customer', 'Keep a simple directory of people who receive finished stock.', `<form class="modal-form" data-form="new-customer"><div class="form-grid"><label class="field-label">Customer name<input name="name" placeholder="Business or person name" required /></label><label class="field-label">Phone <span class="optional">Optional</span><input name="phone" type="tel" placeholder="Phone number" /></label><label class="field-label full-field">Address <span class="optional">Optional</span><textarea name="address" rows="3" placeholder="City or delivery address"></textarea></label></div><div class="modal-footer"><div></div><div><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Add customer ${icon('arrow')}</button></div></div></form>`);
  } else if (type === 'new-vendor') {
    html = modalShell('Add an outside worker', 'Use this for weaving, carbonization, dyeing, or pressing partners.', `<form class="modal-form" data-form="new-vendor"><div class="form-grid"><label class="field-label">Worker or unit name<input name="name" placeholder="Unit name" required /></label><label class="field-label">Main stage<select name="stage">${DEFAULT_STAGES.filter((stage) => stage.type === 'outside').map((stage) => `<option value="${stage.key}">${escapeHtml(stage.label)}</option>`).join('')}</select></label><label class="field-label">Phone <span class="optional">Optional</span><input name="phone" type="tel" placeholder="Phone number" /></label></div><div class="modal-footer"><div></div><div><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Add worker ${icon('arrow')}</button></div></div></form>`);
  } else if (type === 'user-menu') {
    const employees = appState.users.filter((user) => user.role === 'employee' && user.active);
    html = modalShell('Who is using the app?', 'The shared employee login is convenient; the selected name appears in the activity history.', `<div class="role-picker"><button class="role-option ${session.role === 'owner' ? 'is-selected' : ''}" type="button" data-action="choose-user" data-user-id="owner"><span class="avatar avatar-large">O</span><span><strong>Owner</strong><small>Full access</small></span>${session.role === 'owner' ? icon('check') : ''}</button>${employees.map((user) => `<button class="role-option ${session.role === 'employee' && session.employeeId === user.id ? 'is-selected' : ''}" type="button" data-action="choose-user" data-user-id="${user.id}"><span class="avatar avatar-large">${initials(user.name)}</span><span><strong>${escapeHtml(user.name)}</strong><small>Employee access</small></span>${session.role === 'employee' && session.employeeId === user.id ? icon('check') : ''}</button>`).join('')}</div><div class="modal-footer"><span class="muted-copy">A production system should add secure individual logins later.</span><button class="button button-secondary" type="button" data-action="close-modal">Done</button></div>`);
  } else if (type === 'sync-help') {
    html = modalShell('Offline and Sync', 'How the local-first design works', `<div class="sync-modal-content"><div class="sync-flow"><div><span>1</span><strong>Save locally</strong><small>Changes go to IndexedDB on this device.</small></div><div class="sync-flow-line"></div><div><span>2</span><strong>Press Sync</strong><small>When online, the document is sent to the server.</small></div><div class="sync-flow-line"></div><div><span>3</span><strong>Share safely</strong><small>Other devices receive the latest version.</small></div></div><div class="form-tip"><strong>Current status:</strong> ${navigator.onLine ? 'this device has an internet connection.' : 'this device is offline. You can keep working.'} The development server is optional; your data is safe locally either way.</div></div><div class="modal-footer"><button class="button button-primary" type="button" data-action="close-modal">Got it</button></div>`);
  } else if (type === 'learning-guide') {
    html = modalShell('Learning guide', 'A friendly map of the project', `<div class="guide-modal"><p>Read <strong>README.md</strong> for setup and <strong>docs/LEARNING-GUIDE.md</strong> for the project walkthrough.</p><div class="guide-code"><span class="file-icon file-js">JS</span><div><strong>app.js</strong><p>Start here when you want to understand a screen or button.</p></div></div><div class="guide-code"><span class="file-icon file-db">DB</span><div><strong>db.js</strong><p>Learn how the offline database saves data.</p></div></div><div class="guide-code"><span class="file-icon file-css">CSS</span><div><strong>styles.css</strong><p>Change the look of the app safely.</p></div></div></div><div class="modal-footer"><button class="button button-primary" type="button" data-action="close-modal">Close guide</button></div>`);
  } else if (type === 'show-file') {
    const fileName = data.file || 'README.md';
    const descriptions = { 'index.html': 'The HTML structure is the skeleton of each screen.', 'app.js': 'This file handles screens, buttons, forms, and business rules.', 'db.js': 'This file saves data offline in IndexedDB.', 'styles.css': 'This file controls the visual design and responsive layout.' };
    html = modalShell(`Look inside ${fileName}`, 'Use this as a small learning exercise', `<div class="file-preview"><div class="file-preview-header"><span class="file-icon file-js">${fileName.endsWith('.html') ? 'HTML' : fileName.endsWith('.css') ? 'CSS' : 'JS'}</span><strong>${escapeHtml(fileName)}</strong></div><p>${escapeHtml(descriptions[fileName] || 'Open this file in the project folder to read the code.')}</p><div class="code-snippet"><code>const app = document.querySelector('#app-content');<br />app.innerHTML = renderView();<br />renderApp();</code></div></div><div class="modal-footer"><span class="muted-copy">Tip: change one small thing, reload, and compare.</span><button class="button button-primary" type="button" data-action="close-modal">Close</button></div>`);
  } else if (type === 'reset') {
    html = modalShell('Reset sample data?', 'This removes the local records on this device.', `<div class="danger-callout">${icon('warning')}<p>Export a backup first if you want to keep the current data. This prototype reset cannot be undone.</p></div><div class="modal-footer"><button class="button button-secondary" type="button" data-action="export-backup">Export first</button><div><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-danger" type="button" data-action="confirm-reset">Reset everything</button></div></div>`);
  }
  root.innerHTML = html;
}

function openModal(type, data = {}) {
  modalState = { type, data };
  renderModal();
  window.setTimeout(() => document.querySelector('#modal-root [autofocus], #modal-root input, #modal-root select, #modal-root textarea')?.focus(), 20);
}

function closeModal() {
  modalState = null;
  renderModal();
}

// -----------------------------------------------------------------------------
// Mutations and form handling
// -----------------------------------------------------------------------------

function fieldValue(formData, name, fallback = '') {
  const value = formData.get(name);
  return value === null ? fallback : String(value).trim();
}

function numericValue(formData, name, fallback = 0) {
  const value = Number(fieldValue(formData, name, ''));
  return Number.isFinite(value) ? value : fallback;
}

async function commit(message = '', options = {}) {
  rebuildAlerts();
  stateSnapshotForSync();
  appState = await saveState(appState);
  renderApp();
  if (message) showToast(message, 'success');
  if (options.closeModal) closeModal();
  if (options.navigate) {
    currentView = options.navigate;
    if (options.batchId) selectedBatchId = options.batchId;
    renderApp();
  }
}

function stateSnapshotForSync() {
  appState.meta.localOnly = true;
  appState.meta.clientUpdatedAt = nowISO();
  appState.meta.deviceId = getDeviceId();
}

async function handleForm(formType, formData, form) {
  if (formType === 'new-batch') {
    const batchNo = fieldValue(formData, 'batchNo');
    const productId = fieldValue(formData, 'productId');
    if (!batchNo || !productId) return showToast('Batch number and product are required.', 'error');
    if (appState.batches.some((batch) => batch.batchNo.toLowerCase() === batchNo.toLowerCase())) return showToast('That batch number already exists.', 'error');
    const initialPieces = numericValue(formData, 'initialPieces');
    const threadKg = numericValue(formData, 'threadKg');
    if (initialPieces < 1) return showToast('Starting pieces must be at least 1.', 'error');
    const product = getProduct(productId);
    const batch = makeBatch({ id: uid('batch'), batchNo, productId, color: product?.color || '', initialPieces, threadKg, currentStage: 'weaving', expectedDate: fieldValue(formData, 'expectedDate'), locationId: fieldValue(formData, 'locationId', 'loc-shop'), status: 'in_progress', notes: fieldValue(formData, 'notes'), dueStage: 'weaving' });
    const threadItemId = fieldValue(formData, 'threadItemId');
    if (threadItemId) {
      const item = appState.threadStock.find((thread) => thread.id === threadItemId);
      if (item && threadKg > Number(item.quantityKg)) return showToast('That thread lot does not have enough stock.', 'error');
      if (item) {
        item.quantityKg = Math.max(0, Number(item.quantityKg) - threadKg);
        addMovement({ type: 'out', item: item.name, quantity: threadKg, unit: 'kg', locationId: item.locationId, batchId: batch.id, note: 'Issued to weaving batch' });
      }
    }
    appState.batches.unshift(batch);
    addActivity(`${batchNo} was created with ${formatNumber(initialPieces)} pieces.`, 'batch', batch.id);
    await commit('Batch created. It is saved on this device.', { closeModal: true, navigate: 'batch-detail', batchId: batch.id });
    return;
  }
  if (formType === 'new-product') {
    const name = fieldValue(formData, 'name');
    const size = fieldValue(formData, 'size');
    if (!name || !size) return showToast('Product name and size are required.', 'error');
    const custom = {};
    appState.customFields.forEach((field) => { custom[field.id] = fieldValue(formData, `custom_${field.id}`); });
    appState.products.unshift({ id: uid('product'), category: fieldValue(formData, 'category', 'Other'), name, size, weightPerPiece: numericValue(formData, 'weightPerPiece'), fabricType: fieldValue(formData, 'fabricType'), style: fieldValue(formData, 'style'), color: fieldValue(formData, 'color'), custom });
    addActivity(`Product ${name} (${size}) was added.`, 'product');
    await commit('Product added.', { closeModal: true });
    return;
  }
  if (formType === 'update-stage') {
    const batch = getBatch(fieldValue(formData, 'batchId'));
    const stageKey = fieldValue(formData, 'stageKey');
    if (!batch || !STAGE_BY_KEY[stageKey]) return showToast('Batch or stage was not found.', 'error');
    const stage = getStage(batch, stageKey) || makeStage(stageKey);
    const status = fieldValue(formData, 'status');
    const sentQty = numericValue(formData, 'sentQty', 0);
    const receivedQty = fieldValue(formData, 'receivedQty') === '' ? '' : numericValue(formData, 'receivedQty', 0);
    const lossQty = numericValue(formData, 'lossQty', 0);
    stage.status = status;
    stage.sentQty = sentQty;
    stage.receivedQty = receivedQty;
    stage.lossQty = lossQty;
    stage.expectedDate = fieldValue(formData, 'expectedDate') || stage.expectedDate;
    stage.vendorId = fieldValue(formData, 'vendorId') || stage.vendorId;
    stage.notes = fieldValue(formData, 'notes');
    if (status === 'exception' && !stage.notes) return showToast('Add a reason for an exception.', 'error');
    if (status === 'completed' && receivedQty !== '' && lossQty > 0 && receivedQty + lossQty > sentQty) return showToast('Received plus loss cannot be greater than sent.', 'error');
    if (status === 'completed') {
      const index = STAGE_INDEX[stageKey];
      const next = DEFAULT_STAGES[index + 1];
      if (next) {
        batch.currentStage = next.key;
        batch.status = 'in_progress';
        const nextStage = getStage(batch, next.key) || makeStage(next.key);
        nextStage.status = 'pending';
      } else {
        batch.currentStage = 'finished_stock';
        batch.status = 'completed';
        batch.finishedPieces = receivedQty === '' ? Math.max(0, Number(batch.initialPieces) - Number(batch.lossPieces)) : receivedQty;
        batch.locationId = 'loc-finished';
      }
      if (stageKey === 'packing') batch.finishedPieces = receivedQty === '' ? Math.max(0, Number(batch.initialPieces) - Number(batch.lossPieces)) : receivedQty;
      if (lossQty) batch.lossPieces = Number(batch.lossPieces || 0) + lossQty;
      if (stage.vendorId) batch.locationId = stage.vendorId === 'loc-shop' ? 'loc-shop' : getVendor(stage.vendorId)?.id || batch.locationId;
      addMovement({ type: 'in', item: `${batch.batchNo} · ${stage.label}`, quantity: receivedQty || stage.sentQty || batch.initialPieces, unit: 'pcs', locationId: batch.locationId, batchId: batch.id, note: `Completed ${stage.label.toLowerCase()}${lossQty ? ` · ${formatNumber(lossQty)} pcs loss` : ''}` });
    } else if (status === 'sent' || status === 'in_progress') {
      batch.currentStage = stageKey;
      batch.status = status === 'exception' ? 'exception' : 'in_progress';
      if (stage.vendorId) batch.locationId = stage.vendorId;
      if (status === 'sent') addMovement({ type: 'out', item: `${batch.batchNo} · ${stage.label}`, quantity: sentQty, unit: 'pcs', locationId: stage.vendorId || batch.locationId, batchId: batch.id, note: `Sent for ${stage.label.toLowerCase()}` });
    } else if (status === 'exception') {
      batch.status = 'exception';
      addActivity(`${batch.batchNo} was marked with an exception at ${stage.label.toLowerCase()}: ${stage.notes}`, 'exception', batch.id);
    }
    batch.updatedAt = nowISO();
    addActivity(`${batch.batchNo} · ${stage.label} updated as ${titleCase(status)}.`, 'stage', batch.id);
    await commit('Stage updated.', { closeModal: true });
    return;
  }
  if (formType === 'receive-thread') {
    const item = appState.threadStock.find((thread) => thread.id === fieldValue(formData, 'threadItemId'));
    const quantity = numericValue(formData, 'quantityKg');
    if (!item || quantity <= 0) return showToast('Choose a thread lot and enter a quantity.', 'error');
    item.quantityKg = Number(item.quantityKg) + quantity;
    const locationId = fieldValue(formData, 'locationId', item.locationId);
    addMovement({ type: 'in', item: item.name, quantity, unit: 'kg', locationId, batchId: '', note: fieldValue(formData, 'note') || 'Thread received' });
    addActivity(`${formatKg(quantity)} of ${item.name} received.`, 'stock');
    await commit('Thread stock received.', { closeModal: true });
    return;
  }
  if (formType === 'issue-stock') {
    const batch = getBatch(fieldValue(formData, 'batchId'));
    const customerId = fieldValue(formData, 'customerId');
    const pieces = numericValue(formData, 'pieces');
    if (!batch || !customerId) return showToast('Customer and batch are required.', 'error');
    if (pieces < 1 || pieces > getBatchAvailable(batch)) return showToast('Enter a quantity within the available finished stock.', 'error');
    batch.issuedPieces = Number(batch.issuedPieces || 0) + pieces;
    batch.updatedAt = nowISO();
    batch.issues.push({ id: uid('issue'), customerId, batchId: batch.id, pieces, date: todayISO(), promisedDate: fieldValue(formData, 'promisedDate'), deliveredPieces: 0, returnedPieces: 0, replacedPieces: 0, note: fieldValue(formData, 'note'), returnType: '', returnReason: '' });
    addMovement({ type: 'out', item: `${batch.batchNo} · finished pieces`, quantity: pieces, unit: 'pcs', locationId: 'loc-finished', batchId: batch.id, note: `Issued to ${getCustomer(customerId)?.name || 'customer'}` });
    addActivity(`${formatNumber(pieces)} pieces from ${batch.batchNo} issued to ${getCustomer(customerId)?.name || 'customer'}.`, 'customer', batch.id);
    await commit('Finished stock issued to customer.', { closeModal: true, navigate: 'customers' });
    return;
  }
  if (formType === 'return-stock') {
    const issueId = fieldValue(formData, 'issueId');
    const pieces = numericValue(formData, 'pieces');
    const returnType = fieldValue(formData, 'returnType', 'return');
    let issue = null;
    let batch = null;
    appState.batches.forEach((candidate) => { const found = (candidate.issues || []).find((item) => item.id === issueId); if (found) { issue = found; batch = candidate; } });
    if (!issue || !batch || pieces < 1) return showToast('Choose a valid issue and quantity.', 'error');
    if (pieces > Number(issue.pieces) - Number(issue.returnedPieces || 0) - Number(issue.replacedPieces || 0)) return showToast('Quantity is larger than the original issue.', 'error');
    issue.returnType = returnType;
    issue.returnReason = fieldValue(formData, 'reason');
    if (returnType === 'return') {
      issue.returnedPieces = Number(issue.returnedPieces || 0) + pieces;
      batch.finishedPieces = Number(batch.finishedPieces || 0) + pieces;
      addMovement({ type: 'in', item: `${batch.batchNo} · customer return`, quantity: pieces, unit: 'pcs', locationId: 'loc-finished', batchId: batch.id, note: issue.returnReason || 'Returned to finished stock' });
    } else {
      issue.replacedPieces = Number(issue.replacedPieces || 0) + pieces;
      if (pieces > getBatchAvailable(batch)) return showToast('Not enough available stock for the replacement.', 'error');
      batch.issuedPieces = Number(batch.issuedPieces || 0) + pieces;
      addMovement({ type: 'out', item: `${batch.batchNo} · replacement`, quantity: pieces, unit: 'pcs', locationId: 'loc-finished', batchId: batch.id, note: issue.returnReason || 'Replacement sent' });
    }
    addActivity(`${formatNumber(pieces)} pieces from ${batch.batchNo} marked as ${returnType}.`, 'customer', batch.id);
    await commit('Customer return or replacement saved.', { closeModal: true, navigate: 'customers' });
    return;
  }
  if (formType === 'inspection') {
    const batch = getBatch(fieldValue(formData, 'batchId'));
    const result = fieldValue(formData, 'result', 'pass');
    const reason = fieldValue(formData, 'reason');
    if (!batch) return showToast('Choose a batch.', 'error');
    const record = { id: uid('quality'), batchId: batch.id, result: result === 'reject' ? 'rejected' : result, reason, notes: fieldValue(formData, 'notes'), checkedBy: currentActor(), checkedAt: nowISO() };
    batch.quality.push(record);
    appState.quality.push(record);
    const stage = getStage(batch, 'inspection') || makeStage('inspection');
    if (result === 'pass') {
      stage.status = 'completed';
      const next = getStage(batch, 'pressing') || makeStage('pressing');
      if (next.status === 'pending') next.status = 'in_progress';
      batch.currentStage = 'pressing';
      batch.status = 'in_progress';
    } else if (result === 'rework') {
      stage.status = 'rework';
      batch.status = 'exception';
      batch.currentStage = 'inspection';
    } else {
      stage.status = 'rejected';
      batch.status = 'exception';
      batch.currentStage = 'inspection';
      batch.lossPieces = Number(batch.lossPieces || 0) + Number(batch.finishedPieces || batch.initialPieces || 0);
    }
    stage.notes = reason;
    batch.updatedAt = nowISO();
    addActivity(`${batch.batchNo} quality result: ${titleCase(record.result)}. ${reason}`, 'quality', batch.id);
    await commit('Quality result saved.', { closeModal: true, navigate: 'quality' });
    return;
  }
  if (formType === 'note' || formType === 'global-note' || formType === 'quick-note') {
    const text = fieldValue(formData, 'text');
    if (!text) return showToast('Write a note before saving.', 'error');
    const batchId = fieldValue(formData, 'batchId') || form.dataset.batchId || '';
    appState.notes.unshift({ id: uid('note'), batchId, text, author: currentActor(), createdAt: nowISO() });
    addActivity(text, 'note', batchId);
    await commit('Note saved offline.', { closeModal: formType !== 'quick-note' });
    return;
  }
  if (formType === 'new-customer') {
    const name = fieldValue(formData, 'name');
    if (!name) return showToast('Customer name is required.', 'error');
    appState.customers.push({ id: uid('customer'), name, phone: fieldValue(formData, 'phone'), address: fieldValue(formData, 'address') });
    addActivity(`Customer ${name} was added.`, 'customer');
    await commit('Customer added.', { closeModal: true });
    return;
  }
  if (formType === 'new-vendor') {
    const name = fieldValue(formData, 'name');
    if (!name) return showToast('Worker name is required.', 'error');
    appState.vendors.push({ id: uid('vendor'), name, stage: fieldValue(formData, 'stage', 'weaving'), phone: fieldValue(formData, 'phone') });
    addActivity(`Outside worker ${name} was added.`, 'outside');
    await commit('Outside worker added.', { closeModal: true });
    return;
  }
  if (formType === 'custom-field') {
    const label = fieldValue(formData, 'label');
    if (!label) return showToast('Enter a field name.', 'error');
    if (appState.customFields.some((field) => field.label.toLowerCase() === label.toLowerCase())) return showToast('That field already exists.', 'error');
    appState.customFields.push({ id: uid('field'), label, type: fieldValue(formData, 'type', 'text') });
    addActivity(`Custom product field ${label} was added.`, 'settings');
    await commit('Custom field added.');
    return;
  }
  if (formType === 'new-user') {
    const name = fieldValue(formData, 'name');
    if (!name) return showToast('Enter an employee name.', 'error');
    if (appState.users.some((user) => user.name.toLowerCase() === name.toLowerCase())) return showToast('That employee is already listed.', 'error');
    appState.users.push({ id: uid('employee'), name, role: 'employee', active: true });
    addActivity(`Employee ${name} was added.`, 'settings');
    await commit('Employee added.');
    return;
  }
  if (formType === 'settings') {
    appState.settings.lowStockKg = Math.max(0, numericValue(formData, 'lowStockKg', appState.settings.lowStockKg));
    appState.settings.alertLeadDays = Math.max(0, numericValue(formData, 'alertLeadDays', appState.settings.alertLeadDays));
    addActivity('Alert settings were updated.', 'settings');
    await commit('Settings saved.');
    return;
  }
}

async function confirmReset() {
  await clearLocalState();
  appState = createSampleState();
  rebuildAlerts();
  await saveState(appState);
  closeModal();
  currentView = 'dashboard';
  selectedBatchId = null;
  renderApp();
  showToast('Sample workspace restored.', 'success');
}

// -----------------------------------------------------------------------------
// Actions, sync, and event wiring
// -----------------------------------------------------------------------------

function showToast(message, tone = 'default') {
  const root = document.querySelector('#toast-root');
  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.innerHTML = `<span>${tone === 'success' ? icon('check') : tone === 'error' ? icon('warning') : icon('sparkle')}</span><span>${escapeHtml(message)}</span>`;
  root.appendChild(toast);
  window.setTimeout(() => { toast.classList.add('toast-out'); window.setTimeout(() => toast.remove(), 250); }, 3800);
}

function closeMobileNav() {
  document.querySelector('#sidebar')?.classList.remove('is-open');
}

function handleAction(action, target) {
  if (action === 'open-batch') {
    selectedBatchId = target.dataset.batchId;
    currentView = 'batch-detail';
    renderApp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (action.startsWith('open-batch:')) {
    selectedBatchId = action.split(':')[1];
    currentView = 'batch-detail';
    renderApp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (action === 'update-stage') {
    const batchId = target.dataset.batchId;
    const batch = getBatch(batchId);
    openModal('update-stage', { batchId, stageKey: target.dataset.stageKey || batch?.currentStage });
    return;
  }
  if (action.startsWith('update-stage:')) {
    const batchId = action.split(':')[1];
    const batch = getBatch(batchId);
    openModal('update-stage', { batchId, stageKey: batch?.currentStage });
    return;
  }
  if (action.startsWith('toggle-alert:')) {
    const alert = appState.notifications.find((item) => item.id === action.split(':')[1]);
    if (alert) { alert.read = !alert.read; rebuildAlerts(); void saveState(appState).then(renderApp); }
    return;
  }
  if (action.startsWith('open-alert-related:')) {
    const relatedId = action.split(':')[1];
    const batch = appState.batches.find((item) => item.id === relatedId);
    if (batch) { selectedBatchId = batch.id; currentView = 'batch-detail'; renderApp(); }
    return;
  }
  switch (action) {
    case 'new-batch': openModal('new-batch'); break;
    case 'new-product': openModal('new-product'); break;
    case 'receive-thread': openModal('receive-thread', { threadItemId: target.dataset.threadId }); break;
    case 'issue-stock': openModal('issue-stock', { batchId: target.dataset.batchId }); break;
    case 'issue-to-customer': openModal('issue-stock', { customerId: target.dataset.customerId }); break;
    case 'return-stock': openModal('return-stock', { issueId: target.dataset.issueId, batchId: target.dataset.batchId }); break;
    case 'inspection': openModal('inspection', { batchId: target.dataset.batchId }); break;
    case 'note': openModal('note', { batchId: target.dataset.batchId || selectedBatchId }); break;
    case 'new-customer': openModal('new-customer'); break;
    case 'new-vendor': openModal('new-vendor'); break;
    case 'toggle-user-menu': openModal('user-menu'); break;
    case 'sync-help': openModal('sync-help'); break;
    case 'open-learning-guide': openModal('learning-guide'); break;
    case 'show-file': openModal('show-file', { file: target.dataset.file }); break;
    case 'close-modal': closeModal(); break;
    case 'confirm-reset': void confirmReset(); break;
    case 'export-backup': downloadState(appState, `pashmina-flow-${todayISO()}.json`); showToast('Backup downloaded.', 'success'); break;
    case 'inventory-tab': inventoryTab = target.dataset.tab; renderApp(); break;
    case 'clear-filters': searchTerm = ''; batchFilters = { status: 'all', stage: 'all' }; renderApp(); break;
    case 'mark-all-alerts': appState.notifications.forEach((alert) => { if (!alert.resolved) alert.read = true; }); rebuildAlerts(); void saveState(appState).then(renderApp); showToast('All alerts marked as read.'); break;
    case 'view-stage': batchFilters.stage = target.dataset.stage; currentView = 'batches'; renderApp(); break;
    case 'open-alert': currentView = 'alerts'; renderApp(); break;
    case 'sync-now': void syncNow(target); break;
    case 'delete-field': {
      const field = appState.customFields.find((item) => item.id === target.dataset.fieldId);
      if (field) { appState.customFields = appState.customFields.filter((item) => item.id !== field.id); rebuildAlerts(); void saveState(appState).then(renderApp); showToast(`${field.label} removed.`, 'success'); }
      break;
    }
    case 'choose-user': {
      const user = appState.users.find((item) => item.id === target.dataset.userId);
      if (user) { session = user.role === 'owner' ? { role: 'owner', employeeId: 'owner' } : { role: 'employee', employeeId: user.id }; localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session)); closeModal(); renderApp(); showToast(`Now using ${user.name}.`); }
      break;
    }
    default: break;
  }
}

async function syncNow() {
  if (!navigator.onLine) {
    openModal('sync-help');
    showToast('You are offline. Changes are still safe on this device.', 'error');
    return;
  }
  const button = document.querySelector('#sync-button');
  if (button) { button.disabled = true; button.classList.add('is-loading'); }
  try {
    const response = await syncWithServer({ companyId: COMPANY_ID, deviceId: getDeviceId(), baseVersion: Number(appState.meta.serverVersion || 0), state: appState });
    if (response.status === 'conflict') {
      openModal('sync-help');
      showToast('Sync found changes on another device. Review them before merging.', 'error');
      return;
    }
    appState.meta.serverVersion = Number(response.version || appState.meta.serverVersion || 0);
    appState.meta.lastSyncAt = nowISO();
    appState.meta.localOnly = false;
    await saveState(appState);
    renderApp();
    showToast('Synced with the development server.', 'success');
  } catch (error) {
    if (error instanceof SyncError && error.kind === 'network') {
      openModal('sync-help');
      showToast('No sync server connected. Data is safe locally.', 'error');
    } else {
      showToast(error.message || 'Sync failed. Your local data is safe.', 'error');
    }
  } finally {
    const currentButton = document.querySelector('#sync-button');
    if (currentButton) { currentButton.disabled = false; currentButton.classList.remove('is-loading'); }
  }
}

function handleFilterChange(target) {
  const filter = target.dataset.filter;
  if (filter === 'search') {
    searchTerm = target.value;
    const cursor = target.selectionStart;
    renderApp();
    const input = document.querySelector('[data-filter="search"]');
    if (input) { input.focus(); input.setSelectionRange(cursor, cursor); }
  } else if (filter === 'status') {
    batchFilters.status = target.value;
    renderApp();
  } else if (filter === 'stage') {
    batchFilters.stage = target.value;
    renderApp();
  }
}

async function importBackupFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const imported = normalizeState(parseState(text));
    appState = imported;
    rebuildAlerts();
    await saveState(appState);
    currentView = 'dashboard';
    selectedBatchId = null;
    renderApp();
    showToast('Backup imported successfully.', 'success');
  } catch (error) {
    showToast(error.message || 'Could not import that backup.', 'error');
  }
}

function wireEvents() {
  document.addEventListener('click', (event) => {
    const viewTarget = event.target.closest('[data-view]');
    if (viewTarget) {
      currentView = viewTarget.dataset.view;
      if (currentView !== 'batch-detail') selectedBatchId = null;
      closeMobileNav();
      renderApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const actionTarget = event.target.closest('[data-action]');
    if (actionTarget) {
      // The backdrop has close-modal as a convenience. Do not let a click on
      // an input or text inside the dialog bubble up and close the dialog.
      if (actionTarget.classList.contains('modal-backdrop') && event.target !== actionTarget) return;
      handleAction(actionTarget.dataset.action, actionTarget);
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    void handleForm(form.dataset.form, new FormData(form), form);
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('[data-filter]')) handleFilterChange(target);
    if (target.matches('[data-import-backup]')) void importBackupFile(target.files?.[0]);
  });

  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-filter="search"]')) handleFilterChange(event.target);
  });

  document.querySelector('#menu-toggle')?.addEventListener('click', () => document.querySelector('#sidebar')?.classList.toggle('is-open'));
  window.addEventListener('online', () => { renderSyncIndicator(); showToast('Internet connection restored. Sync is available.'); });
  window.addEventListener('offline', () => { renderSyncIndicator(); showToast('You are offline. You can keep working.', 'error'); });
}

async function init() {
  const storedSession = localStorage.getItem(CURRENT_USER_KEY);
  if (storedSession) {
    try { session = JSON.parse(storedSession); } catch (error) { session = { role: 'owner', employeeId: 'owner' }; }
  }
  const loaded = await loadState();
  appState = normalizeState(loaded || createSampleState());
  rebuildAlerts();
  wireEvents();
  renderApp();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Offline shell could not be registered.', error));
  }
  if (!loaded) await saveState(appState);
}

init();
