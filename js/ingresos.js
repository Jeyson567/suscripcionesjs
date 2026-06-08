/**
 * Ingresos Module
 */
const IngresosModule = {
  searchQuery: '',

  init() {
    this.populateMetodos();
    this.populateTipos();
    document.getElementById('btnAddIngreso').addEventListener('click', () => this.openForm());
    document.getElementById('formIngreso').addEventListener('submit', e => this.handleSubmit(e));
    document.getElementById('ingresosSearch').addEventListener('input', Utils.debounce(e => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.renderTable();
    }, 200));

    document.getElementById('ingresoCliente').addEventListener('change', () => {
      this.populateSistemasSelect();
    });
    document.getElementById('ingresoSistema').addEventListener('change', () => {
      this.suggestMonto();
    });
  },

  populateMetodos() {
    const select = document.getElementById('ingresoMetodo');
    select.innerHTML = METODOS_PAGO.map(m => `<option value="${m}">${m}</option>`).join('');
  },

  populateTipos() {
    const select = document.getElementById('ingresoTipo');
    select.innerHTML = TIPOS_PAGO.map(t => `<option value="${t}">${t}</option>`).join('');
  },

  populateSelects() {
    const clienteSelect = document.getElementById('ingresoCliente');
    if (!clienteSelect) return;
    const currentCliente = clienteSelect.value;
    clienteSelect.innerHTML = '<option value="">Seleccionar cliente...</option>' +
      AppState.clientes.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.nombre)}</option>`).join('');
    if (currentCliente) clienteSelect.value = currentCliente;
    this.populateSistemasSelect();
  },

  populateSistemasSelect() {
    const sistemaSelect = document.getElementById('ingresoSistema');
    const clienteId = document.getElementById('ingresoCliente').value;
    const current = sistemaSelect.value;

    let sistemas = AppState.sistemas;
    if (clienteId) sistemas = sistemas.filter(s => s.clienteId === clienteId);

    sistemaSelect.innerHTML = '<option value="">Seleccionar sistema...</option>' +
      sistemas.map(s => {
        const monto = Utils.isSuscripcion(s) ? s.cuotaMensual : s.precio;
        const label = Utils.isSuscripcion(s) ? `${Utils.formatCurrency(monto)}/mes` : Utils.formatCurrency(monto);
        return `<option value="${s.id}" data-cliente="${s.clienteId}">${Utils.escapeHtml(s.nombre)} - ${label}</option>`;
      }).join('');
    if (current) sistemaSelect.value = current;
    this.suggestMonto();
  },

  suggestMonto() {
    const sistemaId = document.getElementById('ingresoSistema').value;
    const montoInput = document.getElementById('ingresoMonto');
    const tipoSelect = document.getElementById('ingresoTipo');
    if (!sistemaId || montoInput.value) return;

    const sistema = AppState.sistemas.find(s => s.id === sistemaId);
    if (!sistema) return;

    if (Utils.isSuscripcion(sistema)) {
      montoInput.value = sistema.cuotaMensual || '';
      tipoSelect.value = 'Cuota mensual';
    } else {
      const pendiente = Analytics.getSaldoSistema(sistema);
      if (pendiente > 0) {
        montoInput.value = pendiente;
        tipoSelect.value = Analytics.getCobradoSistema(sistema.id) > 0 ? 'Abono' : 'Cuota inicial';
      }
    }
  },

  getFiltered() {
    if (!this.searchQuery) return AppState.ingresos;
    return AppState.ingresos.filter(i =>
      [i.clienteNombre, i.sistemaNombre, i.metodo, i.tipoPago, i.observaciones, String(i.monto)]
        .some(v => v?.toLowerCase().includes(this.searchQuery))
    );
  },

  render() {
    this.updateStats();
    this.renderTable();
  },

  updateStats() {
    const now = new Date();
    const monthStart = Utils.startOfMonth(now);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const yearStart = Utils.startOfYear(now);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const totalCobrado = Analytics.sumIngresos(AppState.ingresos);
    const totalPendiente = Analytics.getTotalPendiente();
    const totalMensual = Analytics.sumIngresos(Analytics.getIngresosInRange(monthStart, monthEnd));
    const totalAnual = Analytics.sumIngresos(Analytics.getIngresosInRange(yearStart, yearEnd));
    const cuotaEsperada = Analytics.getIngresoMensualEsperado();
    const morosos = Analytics.getCobrosPendientesMes().length;

    const stats = [
      { label: 'Total cobrado', value: Utils.formatMoney(totalCobrado), icon: 'check-circle', color: 'green', currency: true },
      { label: 'Total pendiente', value: Utils.formatMoney(totalPendiente), icon: 'clock', color: 'orange', currency: true },
      { label: 'Ingresos del mes', value: Utils.formatMoney(totalMensual), icon: 'calendar-alt', color: 'blue', currency: true },
      { label: 'Cuota mensual esperada', value: Utils.formatMoney(cuotaEsperada), icon: 'sync', color: 'purple', currency: true },
      { label: 'Ingresos del año', value: Utils.formatMoney(totalAnual), icon: 'chart-line', color: 'cyan', currency: true },
      { label: 'Suscripciones sin pago', value: morosos, icon: 'exclamation-triangle', color: 'red', currency: false }
    ];

    const el = document.getElementById('ingresosStats');
    if (!el) return;
    el.innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-icon ${s.color}"><i class="fas fa-${s.icon}"></i></div>
        <div class="stat-info">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value${s.currency !== false ? ' currency' : ''}">${s.value}</div>
        </div>
      </div>
    `).join('');
  },

  renderTable() {
    const data = this.getFiltered();
    const tbody = document.querySelector('#ingresosTable tbody');

    if (!data.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay ingresos registrados</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(i => `
      <tr>
        <td>${Utils.escapeHtml(i.clienteNombre || '—')}</td>
        <td>${Utils.escapeHtml(i.sistemaNombre || '—')}</td>
        <td>${Utils.formatDate(i.fecha)}</td>
        <td><strong>${Utils.formatCurrency(i.monto)}</strong></td>
        <td>${Utils.escapeHtml(i.tipoPago || '—')}</td>
        <td>${Utils.escapeHtml(i.metodo || '—')}</td>
        <td>${Utils.escapeHtml(i.observaciones || '—')}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon edit" title="Editar" data-edit="${i.id}"><i class="fas fa-edit"></i></button>
            <button class="btn-icon delete" title="Eliminar" data-delete="${i.id}"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => this.openForm(btn.dataset.edit));
    });
    tbody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => this.delete(btn.dataset.delete));
    });
  },

  openForm(id = null) {
    this.populateSelects();
    document.getElementById('formIngreso').reset();
    document.getElementById('ingresoId').value = '';

    if (id) {
      const i = AppState.ingresos.find(x => x.id === id);
      if (!i) return;
      document.getElementById('modalIngresoTitle').textContent = 'Editar ingreso';
      document.getElementById('ingresoId').value = i.id;
      document.getElementById('ingresoCliente').value = i.clienteId || '';
      this.populateSistemasSelect();
      document.getElementById('ingresoSistema').value = i.sistemaId || '';
      document.getElementById('ingresoFecha').value = Utils.toDateInput(i.fecha);
      document.getElementById('ingresoMonto').value = i.monto || '';
      document.getElementById('ingresoTipo').value = i.tipoPago || 'Otro';
      document.getElementById('ingresoMetodo').value = i.metodo || '';
      document.getElementById('ingresoObservaciones').value = i.observaciones || '';
    } else {
      document.getElementById('modalIngresoTitle').textContent = 'Nuevo ingreso';
      document.getElementById('ingresoFecha').value = new Date().toISOString().split('T')[0];
      document.getElementById('ingresoTipo').value = 'Cuota mensual';
    }

    UI.openModal('modalIngreso');
  },

  async handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('ingresoId').value;
    const clienteId = document.getElementById('ingresoCliente').value;
    const sistemaId = document.getElementById('ingresoSistema').value;
    const cliente = AppState.clientes.find(c => c.id === clienteId);
    const sistema = AppState.sistemas.find(s => s.id === sistemaId);

    const data = {
      clienteId,
      clienteNombre: cliente ? cliente.nombre : '',
      sistemaId,
      sistemaNombre: sistema ? sistema.nombre : '',
      fecha: document.getElementById('ingresoFecha').value,
      monto: parseFloat(document.getElementById('ingresoMonto').value) || 0,
      tipoPago: document.getElementById('ingresoTipo').value,
      metodo: document.getElementById('ingresoMetodo').value,
      observaciones: document.getElementById('ingresoObservaciones').value.trim()
    };

    UI.showLoading(true);
    try {
      if (id) {
        await FirebaseDB.update(FirebaseDB.COLLECTIONS.ingresos, id, data);
        UI.toast('Ingreso actualizado', 'success');
      } else {
        await FirebaseDB.add(FirebaseDB.COLLECTIONS.ingresos, data);
        UI.toast('Ingreso registrado', 'success');
      }
      UI.closeModal('modalIngreso');
    } catch (err) {
      UI.toast('Error al guardar ingreso', 'error');
    } finally {
      UI.showLoading(false);
    }
  },

  delete(id) {
    showConfirm('¿Eliminar este ingreso?', async () => {
      UI.showLoading(true);
      try {
        await FirebaseDB.remove(FirebaseDB.COLLECTIONS.ingresos, id);
        UI.toast('Ingreso eliminado', 'success');
      } catch (err) {
        UI.toast('Error al eliminar', 'error');
      } finally {
        UI.showLoading(false);
      }
    });
  },

  getExportData(format) {
    const data = AppState.ingresos;
    const headers = ['Cliente', 'Sistema', 'Fecha', 'Monto (Q.)', 'Tipo', 'Método', 'Observaciones'];
    const rows = data.map(i => [
      i.clienteNombre, i.sistemaNombre,
      Utils.toDateInput(i.fecha), i.monto, i.tipoPago, i.metodo, i.observaciones
    ]);

    if (format === 'json') ExportService.exportJSON('ingresos', data);
    else if (format === 'excel') ExportService.exportExcel('ingresos', headers, rows, 'Ingresos');
    else if (format === 'pdf') ExportService.exportPDF('ingresos', 'Listado de Ingresos', headers, rows);
  }
};
