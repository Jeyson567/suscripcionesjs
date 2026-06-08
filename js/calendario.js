/**
 * Calendario Module
 */
const CalendarioModule = {
  currentDate: new Date(),
  selectedDate: null,

  init() {
    document.getElementById('calPrev').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render();
    });
    document.getElementById('calNext').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render();
    });
  },

  getEvents() {
    const events = [];

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    AppState.sistemas.forEach(s => {
      if (s.fechaEntrega) {
        events.push({
          type: 'entrega',
          date: s.fechaEntrega,
          title: s.nombre,
          subtitle: `${s.clienteNombre} · ${s.estado}`,
          sistema: s
        });
      }
      if (s.fechaVenta) {
        events.push({
          type: 'venta',
          date: s.fechaVenta,
          title: `Venta: ${s.nombre}`,
          subtitle: s.clienteNombre,
          sistema: s
        });
      }
      if (Utils.isSuscripcion(s) && s.diaCobro && ['Entregado', 'Soporte'].includes(s.estado)) {
        const dia = Math.min(28, Math.max(1, Number(s.diaCobro) || 1));
        const cobroDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const pagado = Analytics.tienePagoMesActual(s.id, new Date(year, month, dia));
        events.push({
          type: pagado ? 'ingreso' : 'cobro',
          date: cobroDate,
          title: `Cobro: ${s.nombre}`,
          subtitle: `${Utils.formatCurrency(s.cuotaMensual)} · ${s.clienteNombre}`,
          sistema: s
        });
      }
    });

    AppState.ingresos.forEach(i => {
      if (i.fecha) {
        events.push({
          type: 'ingreso',
          date: i.fecha,
          title: `Pago: ${Utils.formatCurrency(i.monto)}`,
          subtitle: `${i.clienteNombre} - ${i.sistemaNombre}`,
          ingreso: i
        });
      }
    });

    return events;
  },

  getDateKey(dateStr) {
    const d = Utils.parseDate(dateStr) || (dateStr?.toDate ? dateStr.toDate() : new Date(dateStr));
    if (!d || isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  },

  render() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    document.getElementById('calMonthYear').textContent =
      `${Utils.monthNamesFull[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const events = this.getEvents();
    const eventsByDay = {};

    events.forEach(ev => {
      const key = this.getDateKey(ev.date);
      if (!key) return;
      if (!eventsByDay[key]) eventsByDay[key] = [];
      eventsByDay[key].push(ev);
    });

    const grid = document.getElementById('calendarGrid');
    let html = '';

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startPad - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      html += `<div class="cal-day other-month"><span>${day}</span></div>`;
    }

    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${year}-${month}-${day}`;
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
      const dayEvents = eventsByDay[key] || [];
      const dots = dayEvents.slice(0, 3).map(e => `<span class="cal-dot ${e.type}"></span>`).join('');

      html += `<div class="cal-day${isToday ? ' today' : ''}" data-day="${day}" data-month="${month}" data-year="${year}">
        <span>${day}</span>
        <div class="cal-dots">${dots}</div>
      </div>`;
    }

    const totalCells = startPad + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
      html += `<div class="cal-day other-month"><span>${i}</span></div>`;
    }

    grid.innerHTML = html;
    this.renderSidebars();
  },

  renderSidebars() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inSevenDays = new Date(today);
    inSevenDays.setDate(inSevenDays.getDate() + 7);

    const cobrosPendientes = Analytics.getCobrosPendientesMes().map(p => ({
      date: new Date(today.getFullYear(), today.getMonth(), p.diaCobro),
      title: p.sistema.nombre,
      subtitle: `${Utils.formatCurrency(p.monto)} · ${p.sistema.clienteNombre}`
    }));
    cobrosPendientes.sort((a, b) => a.date - b.date);
    this.renderEventList('cobrosPendientesCal', cobrosPendientes.slice(0, 8), 'No hay cobros pendientes');

    const pendientes = [];
    const proximas = [];
    const importantes = [];
    const seen = new Set();

    AppState.sistemas.forEach(s => {
      if (!s.fechaEntrega || ['Entregado', 'Cotización'].includes(s.estado)) return;
      const d = Utils.parseDate(s.fechaEntrega);
      if (!d) return;

      const key = s.id;
      if (seen.has(key)) return;

      const item = {
        date: d,
        title: s.nombre,
        subtitle: `${s.clienteNombre} · ${s.estado}`
      };

      const day = new Date(d);
      day.setHours(0, 0, 0, 0);

      if (day < today) {
        seen.add(key);
        pendientes.push(item);
      } else if (day <= inSevenDays) {
        seen.add(key);
        proximas.push(item);
      }
    });

    AppState.sistemas.forEach(s => {
      if (s.estado === 'Entregado' && s.fechaEntrega) {
        const d = Utils.parseDate(s.fechaEntrega);
        if (!d) return;
        const diff = Math.abs(d - today) / (1000 * 60 * 60 * 24);
        if (diff <= 30) {
          importantes.push({
            date: d,
            title: s.nombre,
            subtitle: 'Entrega completada'
          });
        }
      }
    });

    AppState.ingresos.slice(0, 5).forEach(i => {
      const d = Utils.parseDate(i.fecha);
      if (d) {
        importantes.push({
          date: d,
          title: `Pago recibido`,
          subtitle: `${Utils.formatCurrency(i.monto)} - ${i.clienteNombre}`
        });
      }
    });

    pendientes.sort((a, b) => a.date - b.date);
    proximas.sort((a, b) => a.date - b.date);

    this.renderEventList('entregasPendientes', pendientes.slice(0, 8), 'No hay entregas pendientes');
    this.renderEventList('entregasProximas', proximas.slice(0, 8), 'No hay entregas próximas');
    this.renderEventList('fechasImportantes', importantes.slice(0, 8), 'No hay fechas importantes');
  },

  renderEventList(containerId, items, emptyMsg) {
    const container = document.getElementById(containerId);
    if (!items.length) {
      container.innerHTML = `<div class="event-empty">${emptyMsg}</div>`;
      return;
    }

    container.innerHTML = items.map(item => {
      const d = item.date;
      return `
        <div class="event-item">
          <div class="event-date">
            <span class="day">${d.getDate()}</span>
            <span class="month">${Utils.monthNames[d.getMonth()]}</span>
          </div>
          <div class="event-info">
            <strong>${Utils.escapeHtml(item.title)}</strong>
            <span>${Utils.escapeHtml(item.subtitle)}</span>
          </div>
        </div>
      `;
    }).join('');
  }
};
