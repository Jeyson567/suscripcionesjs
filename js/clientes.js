/**
 * Clientes Module
 */
const ClientesModule = {
  searchQuery: '',

  init() {
    document.getElementById('btnAddCliente').addEventListener('click', () => this.openForm());
    document.getElementById('formCliente').addEventListener('submit', e => this.handleSubmit(e));
    document.getElementById('clientesSearch').addEventListener('input', Utils.debounce(e => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.renderTable();
    }, 200));
  },

  getFiltered() {
    if (!this.searchQuery) return AppState.clientes;
    return AppState.clientes.filter(c =>
      [c.nombre, c.empresa, c.telefono, c.correo, c.direccion, c.observaciones]
        .some(v => v?.toLowerCase().includes(this.searchQuery))
    );
  },

  renderTable() {
    const data = this.getFiltered();
    const tbody = document.querySelector('#clientesTable tbody');

    if (!data.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No hay clientes registrados</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(c => `
      <tr>
        <td><strong>${Utils.escapeHtml(c.nombre)}</strong></td>
        <td>${Utils.escapeHtml(c.empresa || '—')}</td>
        <td>${Utils.escapeHtml(c.telefono || '—')}</td>
        <td>${Utils.escapeHtml(c.correo || '—')}</td>
        <td>${Utils.escapeHtml(c.direccion || '—')}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon edit" title="Editar" data-edit="${c.id}"><i class="fas fa-edit"></i></button>
            <button class="btn-icon delete" title="Eliminar" data-delete="${c.id}"><i class="fas fa-trash"></i></button>
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
    const form = document.getElementById('formCliente');
    form.reset();
    document.getElementById('clienteId').value = '';

    if (id) {
      const c = AppState.clientes.find(x => x.id === id);
      if (!c) return;
      document.getElementById('modalClienteTitle').textContent = 'Editar cliente';
      document.getElementById('clienteId').value = c.id;
      document.getElementById('clienteNombre').value = c.nombre || '';
      document.getElementById('clienteEmpresa').value = c.empresa || '';
      document.getElementById('clienteTelefono').value = c.telefono || '';
      document.getElementById('clienteCorreo').value = c.correo || '';
      document.getElementById('clienteDireccion').value = c.direccion || '';
      document.getElementById('clienteObservaciones').value = c.observaciones || '';
    } else {
      document.getElementById('modalClienteTitle').textContent = 'Nuevo cliente';
    }

    UI.openModal('modalCliente');
  },

  async handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('clienteId').value;
    const data = {
      nombre: document.getElementById('clienteNombre').value.trim(),
      empresa: document.getElementById('clienteEmpresa').value.trim(),
      telefono: document.getElementById('clienteTelefono').value.trim(),
      correo: document.getElementById('clienteCorreo').value.trim(),
      direccion: document.getElementById('clienteDireccion').value.trim(),
      observaciones: document.getElementById('clienteObservaciones').value.trim()
    };

    UI.showLoading(true);
    try {
      if (id) {
        await FirebaseDB.update(FirebaseDB.COLLECTIONS.clientes, id, data);
        UI.toast('Cliente actualizado', 'success');
      } else {
        await FirebaseDB.add(FirebaseDB.COLLECTIONS.clientes, data);
        UI.toast('Cliente agregado', 'success');
      }
      UI.closeModal('modalCliente');
    } catch (err) {
      UI.toast('Error al guardar cliente', 'error');
    } finally {
      UI.showLoading(false);
    }
  },

  delete(id) {
    const c = AppState.clientes.find(x => x.id === id);
    const used = AppState.sistemas.some(s => s.clienteId === id);
    if (used) {
      UI.toast('No se puede eliminar: el cliente tiene sistemas asociados', 'error');
      return;
    }
    showConfirm(`¿Eliminar a "${c?.nombre}"?`, async () => {
      UI.showLoading(true);
      try {
        await FirebaseDB.remove(FirebaseDB.COLLECTIONS.clientes, id);
        UI.toast('Cliente eliminado', 'success');
      } catch (err) {
        UI.toast('Error al eliminar', 'error');
      } finally {
        UI.showLoading(false);
      }
    });
  },

  getExportData(format) {
    const data = AppState.clientes;
    const headers = ['Nombre', 'Empresa', 'Teléfono', 'Correo', 'Dirección', 'Observaciones'];
    const rows = data.map(c => [c.nombre, c.empresa, c.telefono, c.correo, c.direccion, c.observaciones]);

    if (format === 'json') ExportService.exportJSON('clientes', data);
    else if (format === 'excel') ExportService.exportExcel('clientes', headers, rows, 'Clientes');
    else if (format === 'pdf') ExportService.exportPDF('clientes', 'Listado de Clientes', headers, rows);
  }
};
