/**
 * Sistemas Module
 */
const SistemasModule = {
  searchQuery: '',
  filterEstado: '',
  filterCategoria: '',

  init() {
    this.populateCategorias();
    this.populateEstados();

    document.getElementById('btnAddSistema').addEventListener('click', () => this.openForm());
    document.getElementById('formSistema').addEventListener('submit', e => this.handleSubmit(e));
    document.getElementById('sistemasSearch').addEventListener('input', Utils.debounce(e => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.renderTable();
    }, 200));
    document.getElementById('sistemasFilterEstado').addEventListener('change', e => {
      this.filterEstado = e.target.value;
      this.renderTable();
    });
    document.getElementById('sistemasFilterCategoria').addEventListener('change', e => {
      this.filterCategoria = e.target.value;
      this.renderTable();
    });
  },

  populateCategorias() {
    const opts = CATEGORIAS_SISTEMA.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('sistemaCategoria').innerHTML = opts;
    ['sistemasFilterCategoria', 'statFilterCategoria'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel && sel.options.length <= 1) {
        sel.innerHTML = '<option value="">Todas las categorías</option>' + opts;
      }
    });
  },

  populateEstados() {
    const select = document.getElementById('sistemaEstado');
    select.innerHTML = ESTADOS_SISTEMA.map(e => `<option value="${e}">${e}</option>`).join('');
  },

  populateSelects() {
    const select = document.getElementById('sistemaCliente');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Seleccionar cliente...</option>' +
      AppState.clientes.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.nombre)}${c.empresa ? ' - ' + Utils.escapeHtml(c.empresa) : ''}</option>`).join('');
    if (current) select.value = current;
  },

  getFiltered() {
    let data = [...AppState.sistemas];
    if (this.filterEstado) data = data.filter(s => s.estado === this.filterEstado);
    if (this.filterCategoria) data = data.filter(s => s.categoria === this.filterCategoria);
    if (this.searchQuery) {
      data = data.filter(s =>
        [s.nombre, s.clienteNombre, s.categoria, s.estado, s.descripcion]
          .some(v => v?.toLowerCase().includes(this.searchQuery))
      );
    }
    return data;
  },

  renderTable() {
    this.populateSelects();
    const data = this.getFiltered();
    const tbody = document.querySelector('#sistemasTable tbody');

    if (!data.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay sistemas registrados</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(s => `
      <tr>
        <td><strong>${Utils.escapeHtml(s.nombre)}</strong></td>
        <td>${Utils.escapeHtml(s.clienteNombre || '—')}</td>
        <td>${Utils.escapeHtml(s.categoria || '—')}</td>
        <td>${Utils.formatDate(s.fechaVenta)}</td>
        <td>${Utils.formatDate(s.fechaEntrega)}</td>
        <td>$${Utils.formatMoney(s.precio)}</td>
        <td><span class="badge ${Utils.badgeClass(s.estado)}">${Utils.escapeHtml(s.estado)}</span></td>
        <td>
          <div class="action-btns">
            <button class="btn-icon edit" title="Editar" data-edit="${s.id}"><i class="fas fa-edit"></i></button>
            <button class="btn-icon delete" title="Eliminar" data-delete="${s.id}"><i class="fas fa-trash"></i></button>
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
    const form = document.getElementById('formSistema');
    form.reset();
    document.getElementById('sistemaId').value = '';

    if (id) {
      const s = AppState.sistemas.find(x => x.id === id);
      if (!s) return;
      document.getElementById('modalSistemaTitle').textContent = 'Editar sistema';
      document.getElementById('sistemaId').value = s.id;
      document.getElementById('sistemaNombre').value = s.nombre || '';
      document.getElementById('sistemaCliente').value = s.clienteId || '';
      document.getElementById('sistemaCategoria').value = s.categoria || '';
      document.getElementById('sistemaEstado').value = s.estado || '';
      document.getElementById('sistemaFechaVenta').value = Utils.toDateInput(s.fechaVenta);
      document.getElementById('sistemaFechaEntrega').value = Utils.toDateInput(s.fechaEntrega);
      document.getElementById('sistemaPrecio').value = s.precio || '';
      document.getElementById('sistemaDescripcion').value = s.descripcion || '';
    } else {
      document.getElementById('modalSistemaTitle').textContent = 'Nuevo sistema';
      document.getElementById('sistemaFechaVenta').value = new Date().toISOString().split('T')[0];
    }

    UI.openModal('modalSistema');
  },

  async handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('sistemaId').value;
    const clienteId = document.getElementById('sistemaCliente').value;
    const cliente = AppState.clientes.find(c => c.id === clienteId);

    const data = {
      nombre: document.getElementById('sistemaNombre').value.trim(),
      clienteId,
      clienteNombre: cliente ? cliente.nombre : '',
      categoria: document.getElementById('sistemaCategoria').value,
      estado: document.getElementById('sistemaEstado').value,
      fechaVenta: document.getElementById('sistemaFechaVenta').value,
      fechaEntrega: document.getElementById('sistemaFechaEntrega').value,
      precio: parseFloat(document.getElementById('sistemaPrecio').value) || 0,
      descripcion: document.getElementById('sistemaDescripcion').value.trim()
    };

    UI.showLoading(true);
    try {
      if (id) {
        await FirebaseDB.update(FirebaseDB.COLLECTIONS.sistemas, id, data);
        UI.toast('Sistema actualizado', 'success');
      } else {
        await FirebaseDB.add(FirebaseDB.COLLECTIONS.sistemas, data);
        UI.toast('Sistema agregado', 'success');
      }
      UI.closeModal('modalSistema');
    } catch (err) {
      UI.toast('Error al guardar sistema', 'error');
    } finally {
      UI.showLoading(false);
    }
  },

  delete(id) {
    const s = AppState.sistemas.find(x => x.id === id);
    showConfirm(`¿Eliminar el sistema "${s?.nombre}"?`, async () => {
      UI.showLoading(true);
      try {
        await FirebaseDB.remove(FirebaseDB.COLLECTIONS.sistemas, id);
        UI.toast('Sistema eliminado', 'success');
      } catch (err) {
        UI.toast('Error al eliminar', 'error');
      } finally {
        UI.showLoading(false);
      }
    });
  },

  getExportData(format) {
    const data = AppState.sistemas;
    const headers = ['Sistema', 'Cliente', 'Categoría', 'Fecha Venta', 'Fecha Entrega', 'Precio', 'Estado', 'Descripción'];
    const rows = data.map(s => [
      s.nombre, s.clienteNombre, s.categoria,
      Utils.toDateInput(s.fechaVenta), Utils.toDateInput(s.fechaEntrega),
      s.precio, s.estado, s.descripcion
    ]);

    if (format === 'json') ExportService.exportJSON('sistemas', data);
    else if (format === 'excel') ExportService.exportExcel('sistemas', headers, rows, 'Sistemas');
    else if (format === 'pdf') ExportService.exportPDF('sistemas', 'Listado de Sistemas', headers, rows);
  }
};
