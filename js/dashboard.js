/**
 * Dashboard Module
 */
const DashboardModule = {
  charts: {},

  onDataChange() {
    if (AppState.currentView === 'dashboard') this.render();
  },

  render() {
    this.renderStats();
    this.renderCharts();
    this.renderCobrosPendientes();
    this.renderRecentActivity();
  },

  renderStats() {
    const now = new Date();
    const weekStart = Utils.startOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const monthStart = Utils.startOfMonth(now);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const yearStart = Utils.startOfYear(now);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const ventasSemana = Analytics.getVentasInRange(weekStart, weekEnd).length;
    const ventasMes = Analytics.getVentasInRange(monthStart, monthEnd).length;
    const ventasAnio = Analytics.getVentasInRange(yearStart, yearEnd).length;

    const ingSemana = Analytics.sumIngresos(Analytics.getIngresosInRange(weekStart, weekEnd));
    const ingMes = Analytics.sumIngresos(Analytics.getIngresosInRange(monthStart, monthEnd));
    const ingAnio = Analytics.sumIngresos(Analytics.getIngresosInRange(yearStart, yearEnd));
    const ingTotal = Analytics.sumIngresos(AppState.ingresos);

    const totalSistemas = AppState.sistemas.length;
    const activos = AppState.sistemas.filter(s => ['Desarrollo', 'Pruebas', 'Cotización'].includes(s.estado)).length;
    const entregados = Analytics.getSistemasByEstado('Entregado').length;
    const soporte = Analytics.getSistemasByEstado('Soporte').length;
    const suscripciones = Analytics.getSuscripcionesActivas().length;
    const cuotaMensual = Analytics.getIngresoMensualEsperado();
    const morosos = Analytics.getCobrosPendientesMes().length;
    const pendiente = Analytics.getTotalPendiente();

    const stats = [
      { label: 'Total sistemas', value: totalSistemas, icon: 'server', color: 'blue' },
      { label: 'Sistemas activos', value: activos, icon: 'cogs', color: 'cyan' },
      { label: 'Entregados', value: entregados, icon: 'check-circle', color: 'green' },
      { label: 'En soporte', value: soporte, icon: 'headset', color: 'purple' },
      { label: 'Suscripciones activas', value: suscripciones, icon: 'sync', color: 'purple' },
      { label: 'Cuota mensual esperada', value: Utils.formatMoney(cuotaMensual), icon: 'calendar-check', color: 'blue', currency: true },
      { label: 'Sin pago este mes', value: morosos, icon: 'exclamation-triangle', color: 'red' },
      { label: 'Total pendiente', value: Utils.formatMoney(pendiente), icon: 'hourglass-half', color: 'orange', currency: true },
      { label: 'Ventas del mes', value: ventasMes, icon: 'calendar-alt', color: 'blue' },
      { label: 'Ingresos del mes', value: Utils.formatMoney(ingMes), icon: 'wallet', color: 'green', currency: true },
      { label: 'Ingresos del año', value: Utils.formatMoney(ingAnio), icon: 'piggy-bank', color: 'green', currency: true },
      { label: 'Ingresos totales', value: Utils.formatMoney(ingTotal), icon: 'coins', color: 'orange', currency: true }
    ];

    document.getElementById('dashboardStats').innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-icon ${s.color}"><i class="fas fa-${s.icon}"></i></div>
        <div class="stat-info">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value${s.currency ? ' currency' : ''}">${s.value}</div>
        </div>
      </div>
    `).join('');
  },

  renderCobrosPendientes() {
    const pendientes = Analytics.getCobrosPendientesMes();
    const tbody = document.querySelector('#cobrosPendientesTable tbody');
    if (!tbody) return;

    if (!pendientes.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Todos los cobros del mes están al día</td></tr>';
      return;
    }

    const today = new Date().getDate();
    tbody.innerHTML = pendientes.map(p => {
      const vencido = today > p.diaCobro;
      const estado = vencido ? '<span class="badge badge-pruebas">Vencido</span>' : '<span class="badge badge-desarrollo">Pendiente</span>';
      return `
      <tr>
        <td>${Utils.escapeHtml(p.sistema.clienteNombre || '—')}</td>
        <td><strong>${Utils.escapeHtml(p.sistema.nombre)}</strong></td>
        <td>${Utils.formatCurrency(p.monto)}</td>
        <td>Día ${p.diaCobro}</td>
        <td>${estado}</td>
      </tr>`;
    }).join('');
  },

  renderCharts() {
    const year = new Date().getFullYear();
    const ventasMes = Analytics.getVentasPorMes(year);
    const ingresosMes = Analytics.getIngresosPorMes(year);
    const categorias = Analytics.getSistemasPorCategoria();

    const chartDefaults = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(42,53,72,0.5)' } },
        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(42,53,72,0.5)' } }
      }
    };

    this.destroyChart('ventas');
    this.charts.ventas = new Chart(document.getElementById('chartVentasMes'), {
      type: 'bar',
      data: {
        labels: Utils.monthNames,
        datasets: [{
          label: 'Ventas',
          data: ventasMes,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderRadius: 6
        }]
      },
      options: { ...chartDefaults, plugins: { legend: { display: false } } }
    });

    this.destroyChart('ingresos');
    this.charts.ingresos = new Chart(document.getElementById('chartIngresosMes'), {
      type: 'line',
      data: {
        labels: Utils.monthNames,
        datasets: [{
          label: 'Ingresos (Q.)',
          data: ingresosMes,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        ...chartDefaults,
        plugins: { legend: { display: false } },
        scales: {
          ...chartDefaults.scales,
          y: {
            ...chartDefaults.scales.y,
            ticks: {
              ...chartDefaults.scales.y.ticks,
              callback: v => 'Q.' + v.toLocaleString('es-GT')
            }
          }
        }
      }
    });

    const catLabels = Object.keys(categorias);
    const catData = Object.values(categorias);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316'];

    this.destroyChart('categorias');
    this.charts.categorias = new Chart(document.getElementById('chartCategorias'), {
      type: 'doughnut',
      data: {
        labels: catLabels.length ? catLabels : ['Sin datos'],
        datasets: [{
          data: catData.length ? catData : [1],
          backgroundColor: colors.slice(0, catLabels.length || 1),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12 } } }
      }
    });
  },

  destroyChart(key) {
    if (this.charts[key]) {
      this.charts[key].destroy();
      this.charts[key] = null;
    }
  },

  renderRecentActivity() {
    const activities = [];

    AppState.sistemas.slice(0, 20).forEach(s => {
      activities.push({
        tipo: 'Sistema',
        desc: `${s.nombre} - ${s.clienteNombre || ''}`,
        fecha: s.fechaVenta,
        monto: Utils.isSuscripcion(s) ? s.cuotaMensual : s.precio,
        ts: Utils.getTimestamp(s.fechaVenta)
      });
    });

    AppState.ingresos.slice(0, 20).forEach(i => {
      activities.push({
        tipo: 'Ingreso',
        desc: `${i.clienteNombre} - ${i.sistemaNombre || ''}`,
        fecha: i.fecha,
        monto: i.monto,
        ts: Utils.getTimestamp(i.fecha)
      });
    });

    activities.sort((a, b) => b.ts - a.ts);
    const recent = activities.slice(0, 10);
    const tbody = document.querySelector('#recentActivityTable tbody');

    if (!recent.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No hay actividad reciente</td></tr>';
      return;
    }

    tbody.innerHTML = recent.map(a => `
      <tr>
        <td><span class="badge badge-desarrollo">${Utils.escapeHtml(a.tipo)}</span></td>
        <td>${Utils.escapeHtml(a.desc)}</td>
        <td>${Utils.formatDate(a.fecha)}</td>
        <td>${Utils.formatCurrency(a.monto)}</td>
      </tr>
    `).join('');
  }
};
