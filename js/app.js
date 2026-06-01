/**
 * JS Agency Manager - Core Application
 */
const AppState = {
  clientes: [],
  sistemas: [],
  ingresos: [],
  config: {},
  currentView: 'dashboard',
  unsubscribers: []
};

const PAGE_META = {
  dashboard: { title: 'Dashboard', subtitle: 'Resumen general de tu agencia' },
  clientes: { title: 'Clientes', subtitle: 'Gestión de clientes' },
  sistemas: { title: 'Sistemas', subtitle: 'Sistemas vendidos y en desarrollo' },
  ingresos: { title: 'Ingresos', subtitle: 'Pagos y cobros registrados' },
  estadisticas: { title: 'Estadísticas', subtitle: 'Análisis y reportes' },
  calendario: { title: 'Calendario', subtitle: 'Entregas y fechas importantes' },
  configuracion: { title: 'Configuración', subtitle: 'Ajustes de la agencia' }
};

const Utils = {
  formatMoney(amount) {
    const n = Number(amount) || 0;
    return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  toDateInput(dateStr) {
    if (!dateStr) return '';
    const d = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  },

  parseDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
  },

  getTimestamp(dateStr) {
    const d = this.parseDate(dateStr) || (dateStr?.toDate ? dateStr.toDate() : new Date(dateStr));
    return d && !isNaN(d.getTime()) ? d.getTime() : 0;
  },

  startOfWeek(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  startOfMonth(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  },

  startOfYear(date = new Date()) {
    return new Date(date.getFullYear(), 0, 1);
  },

  isInRange(dateStr, start, end) {
    const ts = this.getTimestamp(dateStr);
    return ts >= start.getTime() && ts <= end.getTime();
  },

  badgeClass(estado) {
    const map = {
      'Cotización': 'badge-cotizacion',
      'Desarrollo': 'badge-desarrollo',
      'Pruebas': 'badge-pruebas',
      'Entregado': 'badge-entregado',
      'Soporte': 'badge-soporte'
    };
    return map[estado] || 'badge-cotizacion';
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  monthNames: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  monthNamesFull: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
};

const UI = {
  showLoading(show = true) {
    document.getElementById('loadingOverlay').hidden = !show;
  },

  toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    el.innerHTML = `<i class="fas fa-${icon}"></i><span>${Utils.escapeHtml(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  },

  openModal(id) {
    document.getElementById(id).hidden = false;
    document.body.style.overflow = 'hidden';
  },

  closeModal(id) {
    document.getElementById(id).hidden = true;
    if (!document.querySelector('.modal-overlay:not([hidden])')) {
      document.body.style.overflow = '';
    }
  },

  navigate(view) {
    AppState.currentView = view;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(el => {
      el.classList.toggle('active', el.id === `view-${view}`);
    });
    const meta = PAGE_META[view] || PAGE_META.dashboard;
    document.getElementById('pageTitle').textContent = meta.title;
    document.getElementById('pageSubtitle').textContent = meta.subtitle;

    const handlers = {
      dashboard: () => DashboardModule.render(),
      clientes: () => ClientesModule.renderTable(),
      sistemas: () => SistemasModule.renderTable(),
      ingresos: () => IngresosModule.render(),
      estadisticas: () => EstadisticasModule.render(),
      calendario: () => CalendarioModule.render(),
      configuracion: () => ConfiguracionModule.load()
    };
    if (handlers[view]) handlers[view]();
  }
};

let confirmCallback = null;

const ExportService = {
  exportJSON(module, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.download(blob, `${module}_${Date.now()}.json`);
  },

  exportExcel(module, headers, rows, sheetName) {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || module);
    XLSX.writeFile(wb, `${module}_${Date.now()}.xlsx`);
  },

  exportPDF(module, title, headers, rows) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: rows[0]?.length > 6 ? 'landscape' : 'portrait' });
    const agency = AppState.config.nombre || 'JS Agency Manager';
    doc.setFontSize(16);
    doc.text(agency, 14, 15);
    doc.setFontSize(12);
    doc.text(title, 14, 24);
    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 30,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246] }
    });
    doc.save(`${module}_${Date.now()}.pdf`);
  },

  download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  handleExport(module, format) {
    const exporters = {
      clientes: () => ClientesModule.getExportData(format),
      sistemas: () => SistemasModule.getExportData(format),
      ingresos: () => IngresosModule.getExportData(format)
    };
    const fn = exporters[module];
    if (fn) fn();
  }
};

const GlobalSearch = {
  init() {
    const input = document.getElementById('globalSearch');
    const results = document.getElementById('searchResults');

    input.addEventListener('input', Utils.debounce(() => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) {
        results.hidden = true;
        return;
      }
      this.render(q, results);
      results.hidden = false;
    }, 200));

    document.addEventListener('click', e => {
      if (!e.target.closest('.global-search')) results.hidden = true;
    });
  },

  render(q, container) {
    const clientes = AppState.clientes.filter(c =>
    [c.nombre, c.empresa, c.correo, c.telefono].some(v => v?.toLowerCase().includes(q))
  ).slice(0, 5);

  const sistemas = AppState.sistemas.filter(s =>
    [s.nombre, s.clienteNombre, s.categoria, s.estado].some(v => v?.toLowerCase().includes(q))
  ).slice(0, 5);

  const ingresos = AppState.ingresos.filter(i =>
    [i.clienteNombre, i.sistemaNombre, i.metodo].some(v => v?.toLowerCase().includes(q)) ||
    String(i.monto).includes(q)
  ).slice(0, 5);

  if (!clientes.length && !sistemas.length && !ingresos.length) {
    container.innerHTML = '<div class="search-empty">Sin resultados</div>';
    return;
  }

  let html = '';
  if (clientes.length) {
    html += '<div class="search-group"><div class="search-group-title">Clientes</div>';
    clientes.forEach(c => {
      html += `<div class="search-item" data-nav="clientes">
        <strong>${Utils.escapeHtml(c.nombre)}</strong>
        <span>${Utils.escapeHtml(c.empresa || c.correo || '')}</span></div>`;
    });
    html += '</div>';
  }
  if (sistemas.length) {
    html += '<div class="search-group"><div class="search-group-title">Sistemas</div>';
    sistemas.forEach(s => {
      html += `<div class="search-item" data-nav="sistemas">
        <strong>${Utils.escapeHtml(s.nombre)}</strong>
        <span>${Utils.escapeHtml(s.clienteNombre)} · ${Utils.escapeHtml(s.estado)}</span></div>`;
    });
    html += '</div>';
  }
  if (ingresos.length) {
    html += '<div class="search-group"><div class="search-group-title">Ingresos</div>';
    ingresos.forEach(i => {
      html += `<div class="search-item" data-nav="ingresos">
        <strong>$${Utils.formatMoney(i.monto)}</strong>
        <span>${Utils.escapeHtml(i.clienteNombre)} · ${Utils.escapeHtml(i.sistemaNombre || '')}</span></div>`;
    });
    html += '</div>';
  }

  container.innerHTML = html;
    container.querySelectorAll('.search-item').forEach(el => {
      el.addEventListener('click', () => {
        UI.navigate(el.dataset.nav);
        document.getElementById('globalSearch').value = '';
        container.hidden = true;
      });
    });
  }
};

const Analytics = {
  getSistemasActivos() {
    return AppState.sistemas.filter(s =>
      !['Entregado'].includes(s.estado) || s.estado === 'Soporte'
    );
  },

  getSistemasByEstado(estado) {
    return AppState.sistemas.filter(s => s.estado === estado);
  },

  getVentasInRange(start, end) {
    return AppState.sistemas.filter(s =>
      Utils.isInRange(s.fechaVenta, start, end)
    );
  },

  getIngresosInRange(start, end) {
    return AppState.ingresos.filter(i =>
      Utils.isInRange(i.fecha, start, end)
    );
  },

  sumIngresos(items) {
    return items.reduce((sum, i) => sum + (Number(i.monto) || 0), 0);
  },

  sumPreciosSistemas(items) {
    return items.reduce((sum, s) => sum + (Number(s.precio) || 0), 0);
  },

  getTotalPendiente() {
    let total = 0;
    AppState.sistemas.forEach(s => {
      const precio = Number(s.precio) || 0;
      const cobrado = AppState.ingresos
        .filter(i => i.sistemaId === s.id)
        .reduce((sum, i) => sum + (Number(i.monto) || 0), 0);
      total += Math.max(0, precio - cobrado);
    });
    return total;
  },

  getVentasPorMes(year) {
    const months = Array(12).fill(0);
    AppState.sistemas.forEach(s => {
      const d = Utils.parseDate(s.fechaVenta);
      if (d && d.getFullYear() === year) months[d.getMonth()]++;
    });
    return months;
  },

  getIngresosPorMes(year) {
    const months = Array(12).fill(0);
    AppState.ingresos.forEach(i => {
      const d = Utils.parseDate(i.fecha);
      if (d && d.getFullYear() === year) months[d.getMonth()] += Number(i.monto) || 0;
    });
    return months;
  },

  getSistemasPorCategoria() {
    const map = {};
    AppState.sistemas.forEach(s => {
      const cat = s.categoria || 'Otro';
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  },

  applyFilters({ anio, mes, clienteId, categoria }) {
    let sistemas = [...AppState.sistemas];
    let ingresos = [...AppState.ingresos];

    if (anio) {
      const y = Number(anio);
      sistemas = sistemas.filter(s => {
        const d = Utils.parseDate(s.fechaVenta);
        return d && d.getFullYear() === y;
      });
      ingresos = ingresos.filter(i => {
        const d = Utils.parseDate(i.fecha);
        return d && d.getFullYear() === y;
      });
    }
    if (mes !== '' && mes !== undefined) {
      const m = Number(mes);
      sistemas = sistemas.filter(s => {
        const d = Utils.parseDate(s.fechaVenta);
        return d && d.getMonth() === m;
      });
      ingresos = ingresos.filter(i => {
        const d = Utils.parseDate(i.fecha);
        return d && d.getMonth() === m;
      });
    }
    if (clienteId) {
      sistemas = sistemas.filter(s => s.clienteId === clienteId);
      ingresos = ingresos.filter(i => i.clienteId === clienteId);
    }
    if (categoria) {
      sistemas = sistemas.filter(s => s.categoria === categoria);
    }
    return { sistemas, ingresos };
  }
};

function applyBranding() {
  const cfg = AppState.config;
  const name = cfg.nombre || 'JS Agency';
  document.getElementById('brandName').textContent = name;
  document.title = `${name} - Manager`;

  const logoUrl = cfg.logo;
  const sidebarLogo = document.getElementById('sidebarLogo');
  const placeholder = document.getElementById('logoPlaceholder');

  if (logoUrl) {
    sidebarLogo.src = logoUrl;
    sidebarLogo.hidden = false;
    placeholder.style.display = 'none';
  } else {
    sidebarLogo.hidden = true;
    placeholder.style.display = 'flex';
  }
}

function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const app = document.getElementById('app');

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    } else {
      sidebar.classList.toggle('collapsed');
      app.classList.toggle('sidebar-collapsed');
    }
  });

  document.getElementById('sidebarClose').addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
}

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      UI.navigate(el.dataset.view);
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
      }
    });
  });
}

function initModals() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => UI.closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) UI.closeModal(overlay.id);
    });
  });

  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (confirmCallback) await confirmCallback();
    UI.closeModal('modalConfirm');
    confirmCallback = null;
  });
}

function showConfirm(message, callback) {
  document.getElementById('confirmMessage').textContent = message;
  confirmCallback = callback;
  UI.openModal('modalConfirm');
}

function initFirestoreListeners() {
  AppState.unsubscribers.forEach(u => u && u());
  AppState.unsubscribers = [];

  AppState.unsubscribers.push(
    FirebaseDB.subscribe(FirebaseDB.COLLECTIONS.clientes, data => {
      AppState.clientes = data;
      if (AppState.currentView === 'clientes') ClientesModule.renderTable();
      if (['sistemas', 'ingresos', 'estadisticas'].includes(AppState.currentView)) {
        SistemasModule.populateSelects?.();
        IngresosModule.populateSelects?.();
      }
      DashboardModule.onDataChange();
      EstadisticasModule.onDataChange?.();
    })
  );

  AppState.unsubscribers.push(
    FirebaseDB.subscribe(FirebaseDB.COLLECTIONS.sistemas, data => {
      AppState.sistemas = data;
      if (AppState.currentView === 'sistemas') SistemasModule.renderTable();
      if (AppState.currentView === 'ingresos') IngresosModule.populateSelects();
      if (AppState.currentView === 'calendario') CalendarioModule.render();
      DashboardModule.onDataChange();
      EstadisticasModule.onDataChange?.();
      IngresosModule.updateStats?.();
    })
  );

  AppState.unsubscribers.push(
    FirebaseDB.subscribe(FirebaseDB.COLLECTIONS.ingresos, data => {
      AppState.ingresos = data;
      if (AppState.currentView === 'ingresos') IngresosModule.renderTable();
      DashboardModule.onDataChange();
      EstadisticasModule.onDataChange?.();
      IngresosModule.updateStats?.();
    })
  );

  FirebaseDB.getDoc(FirebaseDB.COLLECTIONS.configuracion, 'general').then(cfg => {
    AppState.config = cfg || {};
    applyBranding();
    if (AppState.currentView === 'configuracion') ConfiguracionModule.load();
  });
}

function initExports() {
  document.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => {
      ExportService.handleExport(btn.dataset.export, btn.dataset.format);
    });
  });
}

function initBackup() {
  document.getElementById('btnExportBackup').addEventListener('click', async () => {
    UI.showLoading(true);
    try {
      const backup = {
        exportDate: new Date().toISOString(),
        clientes: AppState.clientes,
        sistemas: AppState.sistemas,
        ingresos: AppState.ingresos,
        configuracion: AppState.config
      };
      ExportService.exportJSON('respaldo_js_agency', backup);
      UI.toast('Respaldo exportado correctamente', 'success');
    } catch (err) {
      UI.toast('Error al exportar respaldo', 'error');
    } finally {
      UI.showLoading(false);
    }
  });

  document.getElementById('btnImportBackup').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.clientes && !data.sistemas && !data.ingresos) {
        throw new Error('Formato inválido');
      }
      showConfirm('¿Importar respaldo? Esto reemplazará los datos actuales.', async () => {
        UI.showLoading(true);
        try {
          await FirebaseDB.importBackup(data);
          UI.toast('Respaldo importado correctamente', 'success');
        } catch (err) {
          UI.toast('Error al importar: ' + err.message, 'error');
        } finally {
          UI.showLoading(false);
        }
      });
    } catch (err) {
      UI.toast('Archivo JSON inválido', 'error');
    }
    e.target.value = '';
  });
}

async function initApp() {
  UI.showLoading(true);
  initSidebar();
  initNavigation();
  initModals();
  GlobalSearch.init();
  initExports();
  initBackup();

  document.getElementById('refreshBtn').addEventListener('click', () => {
    DashboardModule.onDataChange();
    UI.toast('Datos actualizados', 'success');
  });

  ClientesModule.init();
  SistemasModule.init();
  IngresosModule.init();
  EstadisticasModule.init();
  CalendarioModule.init();
  ConfiguracionModule.init();

  initFirestoreListeners();
  UI.navigate('dashboard');
  UI.showLoading(false);
}

document.addEventListener('DOMContentLoaded', initApp);
