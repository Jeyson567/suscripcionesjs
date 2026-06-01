/**
 * Configuración Module
 */
const ConfiguracionModule = {
  logoBase64: null,

  init() {
    document.getElementById('configForm').addEventListener('submit', e => this.handleSubmit(e));
    document.getElementById('btnSelectLogo').addEventListener('click', () => {
      document.getElementById('configLogo').click();
    });
    document.getElementById('configLogo').addEventListener('change', e => this.handleLogoSelect(e));
  },

  load() {
    const cfg = AppState.config || {};
    document.getElementById('configNombre').value = cfg.nombre || 'JS Agency';
    document.getElementById('configInfo').value = cfg.info || '';
    document.getElementById('configTelefono').value = cfg.telefono || '';
    document.getElementById('configCorreo').value = cfg.correo || '';
    document.getElementById('configDireccion').value = cfg.direccion || '';

    const preview = document.getElementById('configLogoPreview');
    const placeholder = document.getElementById('configLogoPlaceholder');

    if (cfg.logo) {
      preview.src = cfg.logo;
      preview.hidden = false;
      placeholder.style.display = 'none';
      this.logoBase64 = cfg.logo;
    } else {
      preview.hidden = true;
      placeholder.style.display = 'flex';
      this.logoBase64 = null;
    }
  },

  handleLogoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) {
      UI.toast('La imagen debe ser menor a 500KB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      this.logoBase64 = ev.target.result;
      const preview = document.getElementById('configLogoPreview');
      preview.src = this.logoBase64;
      preview.hidden = false;
      document.getElementById('configLogoPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
  },

  async handleSubmit(e) {
    e.preventDefault();
    const data = {
      nombre: document.getElementById('configNombre').value.trim(),
      info: document.getElementById('configInfo').value.trim(),
      telefono: document.getElementById('configTelefono').value.trim(),
      correo: document.getElementById('configCorreo').value.trim(),
      direccion: document.getElementById('configDireccion').value.trim()
    };

    if (this.logoBase64) data.logo = this.logoBase64;

    UI.showLoading(true);
    try {
      await FirebaseDB.setDoc(FirebaseDB.COLLECTIONS.configuracion, 'general', data);
      AppState.config = { ...AppState.config, ...data };
      applyBranding();
      UI.toast('Configuración guardada', 'success');
    } catch (err) {
      UI.toast('Error al guardar configuración', 'error');
    } finally {
      UI.showLoading(false);
    }
  }
};
