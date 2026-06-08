/**
 * Estadísticas Module
 */
const EstadisticasModule = {
  charts: {},
  filters: { anio: '', mes: '', clienteId: '', categoria: '' },

  init() {
    this.populateYearFilter();
    this.bindFilters();
  },

  populateYearFilter() {
    const select = document.getElementById('statFilterAnio');
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);
    select.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    this.filters.anio = String(currentYear);
  },

  populateClienteFilter() {
    const select = document.getElementById('statFilterCliente');
    const current = select.value;
    select.innerHTML = '<option value="">Todos los clientes</option>' +
      AppState.clientes.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.nombre)}</option>`).join('');
    if (current) select.value = current;
  },

  bindFilters() {
    ['statFilterAnio', 'statFilterMes', 'statFilterCliente', 'statFilterCategoria'].forEach(id => {
      document.getElementById(id).addEventListener('change', e => {
        const key = id.replace('statFilter', '').toLowerCase();
        const map = { anio: 'anio', mes: 'mes', cliente: 'clienteId', categoria: 'categoria' };
        this.filters[map[key] || key] = e.target.value;
        this.render();
      });
    });
  },

  onDataChange() {
    if (AppState.currentView === 'estadisticas') this.render();
  },

  render() {
    this.populateClienteFilter();
    SistemasModule.populateCategorias();

    const { sistemas, ingresos } = Analytics.applyFilters({
      anio: this.filters.anio,
      mes: document.getElementById('statFilterMes').value,
      clienteId: this.filters.clienteId,
      categoria: this.filters.categoria
    });

    const now = new Date();
    const year = Number(this.filters.anio) || now.getFullYear();

    const weekStart = Utils.startOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(year, now.getMonth(), 1);
    const monthEnd = new Date(year, now.getMonth() + 1, 0, 23, 59, 59, 999);
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const ventasSemana = sistemas.filter(s => Utils.isInRange(s.fechaVenta, weekStart, weekEnd)).length;
    const ventasMes = sistemas.filter(s => Utils.isInRange(s.fechaVenta, monthStart, monthEnd)).length;
    const ventasAnio = sistemas.filter(s => Utils.isInRange(s.fechaVenta, yearStart, yearEnd)).length;

    const ingSemana = Analytics.sumIngresos(ingresos.filter(i => Utils.isInRange(i.fecha, weekStart, weekEnd)));
    const ingMes = Analytics.sumIngresos(ingresos.filter(i => Utils.isInRange(i.fecha, monthStart, monthEnd)));
    const ingAnio = Analytics.sumIngresos(ingresos.filter(i => Utils.isInRange(i.fecha, yearStart, yearEnd)));

    const stats = [
      { label: 'Ventas semana', value: ventasSemana, icon: 'shopping-cart', color: 'blue' },
      { label: 'Ventas mes', value: ventasMes, icon: 'calendar', color: 'blue' },
      { label: 'Ventas año', value: ventasAnio, icon: 'chart-bar', color: 'blue' },
      { label: 'Ingresos semana', value: Utils.formatMoney(ingSemana), icon: 'coins', color: 'green', currency: true },
      { label: 'Ingresos mes', value: Utils.formatMoney(ingMes), icon: 'wallet', color: 'green', currency: true },
      { label: 'Ingresos año', value: Utils.formatMoney(ingAnio), icon: 'piggy-bank', color: 'green', currency: true }
    ];

    document.getElementById('estadisticasStats').innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-icon ${s.color}"><i class="fas fa-${s.icon}"></i></div>
        <div class="stat-info">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value${s.currency ? ' currency' : ''}">${s.value}</div>
        </div>
      </div>
    `).join('');

    this.renderCharts(sistemas, ingresos, year);
  },

  renderCharts(sistemas, ingresos, year) {
    const ventasMes = Array(12).fill(0);
    sistemas.forEach(s => {
      const d = Utils.parseDate(s.fechaVenta);
      if (d && d.getFullYear() === year) ventasMes[d.getMonth()]++;
    });

    const ingresosMes = Array(12).fill(0);
    ingresos.forEach(i => {
      const d = Utils.parseDate(i.fecha);
      if (d && d.getFullYear() === year) ingresosMes[d.getMonth()] += Number(i.monto) || 0;
    });

    const chartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(42,53,72,0.5)' } },
        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(42,53,72,0.5)' } }
      }
    };

    if (this.charts.ventas) this.charts.ventas.destroy();
    this.charts.ventas = new Chart(document.getElementById('chartStatVentas'), {
      type: 'bar',
      data: {
        labels: Utils.monthNamesFull,
        datasets: [{
          label: 'Ventas',
          data: ventasMes,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderRadius: 6
        }]
      },
      options: { ...chartOpts, plugins: { legend: { display: false } } }
    });

    if (this.charts.ingresos) this.charts.ingresos.destroy();
    this.charts.ingresos = new Chart(document.getElementById('chartStatIngresos'), {
      type: 'line',
      data: {
        labels: Utils.monthNamesFull,
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
        ...chartOpts,
        scales: {
          ...chartOpts.scales,
          y: {
            ...chartOpts.scales.y,
            ticks: {
              ...chartOpts.scales.y.ticks,
              callback: v => 'Q.' + v.toLocaleString('es-GT')
            }
          }
        }
      }
    });
  }
};
