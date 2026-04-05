export const TRANSLATIONS = {
    en: {
        conn_not_connected: 'NOT_CONNECTED',
        login_nip07: 'Login (NIP-07)',
        login_manual_btn: 'Manual (nsec)',
        login_manual_title: 'Manual Authentication',
        caution_nsec: '[!] CAUTION: Do not share your nsec on untrusted sites. It will be cleared on reload.',
        btn_authenticate: 'Authenticate_Crypto',
        section_conn: 'Connectivity Config',
        network_public: 'Public_Network',
        network_private: 'Tor_Encrypted',
        relay_uri_label: 'RELAY_URI',
        tor_warning: '[WARNING] Onion address requires Tor Network browser.',
        btn_establish_conn: 'Establish_Connection',
        btn_establishing: 'ESTABLISHING...',
        section_broadcast: 'Broadcast Data',
        msg_placeholder: '// Write message for the void...',
        btn_sign_broadcast: 'Sign & Broadcast',
        btn_signing: 'SIGNING...',
        section_stream: 'Data Stream [Kind 1]',
        console_title: 'System Console // Nostr Events',
        console_ready: 'READY',
        console_stream: 'STREAM_ACTIVE',
        log_init: '[SYS] Dashboard initialized. Awaiting user interaction.',
        log_connecting: 'Attempting connection to: ',
        log_connected: 'Successfully connected to ',
        log_disconnected: 'Disconnected from ',
        log_sub_start: 'Starting subscription kind:1 for ',
        log_auth_start: 'Requesting public key from extension...',
        log_auth_manual: 'Attempting local authentication with provided nsec...',
        log_auth_success: 'Identity verified: ',
        log_sign_start: 'Requesting signature for Event Kind 1...',
        log_publish_start: 'Event signed. Publishing ID: ',
        log_publish_success: 'Relay confirmed receipt [OK].',
        log_error: 'Error: ',
        status_connected: 'CONNECTED // ',
        publish_btn_label: 'Sign & Broadcast',
        log_auth_nip42_start: 'NIP-42 AUTH challenge received. Authenticating...',
        log_auth_nip42_ok: 'NIP-42 Authentication sent successfully.',
        log_react_start: 'Signing reaction Kind 7...',
        log_react_ok: 'Reaction sent successfully.',
        btn_logout: 'Logout',
        btn_close: 'Close',
        feed_global: 'GLOBAL',
        feed_following: 'FOLLOWING',
        btn_follow: 'Follow',
        btn_unfollow: 'Unfollow',
        log_follow_ok: 'Successfully added to following.',
        log_unfollow_ok: 'Successfully removed from following.',
        log_profile_init: 'Fetching profile: ',
        log_profile_ok: 'Profile loaded: '
    },
    es: {
        conn_not_connected: 'NO_CONECTADO',
        login_nip07: 'Acceder (NIP-07)',
        login_manual_btn: 'Manual (nsec)',
        login_manual_title: 'Autenticación Manual',
        caution_nsec: '[!] PRECAUCIÓN: No compartas tu nsec en sitios no confiables. Se borrará al recargar.',
        btn_authenticate: 'Autenticar_Criptografía',
        section_conn: 'Configuración de Conexión',
        network_public: 'Red_Pública',
        network_private: 'Tor_Cifrado',
        relay_uri_label: 'URI_DEL_RELAY',
        tor_warning: '[AVISO] Las direcciones .onion requieren el navegador Tor.',
        btn_establish_conn: 'Establecer_Conexión',
        btn_establishing: 'ESTABLECIENDO...',
        section_broadcast: 'Transmitir Datos',
        msg_placeholder: '// Escribe un mensaje para el vacío...',
        btn_sign_broadcast: 'Firmar y Transmitir',
        btn_signing: 'FIRMANDO...',
        section_stream: 'Flujo de Datos [Tipo 1]',
        console_title: 'Consola del Sistema // Eventos Nostr',
        console_ready: 'LISTO',
        console_stream: 'STREAM_ACTIVO',
        log_init: '[SYS] Panel inicializado. Esperando interacción del usuario.',
        log_connecting: 'Intentando conexión a: ',
        log_connected: 'Conectado exitosamente a ',
        log_disconnected: 'Desconectado de ',
        log_sub_start: 'Iniciando suscripción tipo:1 para ',
        log_auth_start: 'Solicitando clave pública a la extensión...',
        log_auth_manual: 'Intentando autenticación local con el nsec provisto...',
        log_auth_success: 'Identidad verificada: ',
        log_sign_start: 'Solicitando firma para Evento Tipo 1...',
        log_publish_start: 'Evento firmado. Publicando ID: ',
        log_publish_success: 'Relay confirmó recepción [OK].',
        log_error: 'Error: ',
        status_connected: 'CONECTADO // ',
        publish_btn_label: 'Firmar y Transmitir',
        log_auth_nip42_start: 'Desafío NIP-42 (AUTH) recibido. Autenticando...',
        log_auth_nip42_ok: 'Autenticación NIP-42 enviada con éxito.',
        log_react_start: 'Firmando reacción Tipo 7...',
        log_react_ok: 'Reacción enviada con éxito.',
        btn_logout: 'Cerrar Sesión',
        btn_close: 'Cerrar',
        feed_global: 'GLOBAL',
        feed_following: 'SIGUIENDO',
        btn_follow: 'Seguir',
        btn_unfollow: 'Dejar de seguir',
        log_follow_ok: 'Usuario añadido a seguidos correctamente.',
        log_unfollow_ok: 'Usuario eliminado de seguidos correctamente.',
        log_profile_init: 'Buscando perfil: ',
        log_profile_ok: 'Perfil cargado: '
    }
};

export class UIManager {
    constructor() {
        this.currentLang = localStorage.getItem('lang') || 'es';
        this.consoleLog = document.getElementById('console-log');
    }

    setLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('lang', lang);
        document.documentElement.lang = lang;
        
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (TRANSLATIONS[lang][key]) el.textContent = TRANSLATIONS[lang][key];
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (TRANSLATIONS[lang][key]) el.placeholder = TRANSLATIONS[lang][key];
        });

        // Trigger visual updates for lang buttons
        document.getElementById('lang-en')?.classList.toggle('active', lang === 'en');
        document.getElementById('lang-es')?.classList.toggle('active', lang === 'es');

        // Notify app to refresh non-i18n elements
        window.dispatchEvent(new CustomEvent('langChanged', { detail: { lang } }));
    }

    log(msgKey, extra = '', type = 'info') {
        if (!this.consoleLog) return;
        const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
        const entry = document.createElement('div');
        entry.className = `log-entry ${type === 'warn' ? 'log-warn' : type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : ''}`;
        const trans = TRANSLATIONS[this.currentLang][msgKey] || msgKey;
        entry.innerHTML = `<span class="log-time">${time}</span> ${trans}${extra}`;
        this.consoleLog.prepend(entry);
    }

    showModal(modalId) {
        document.getElementById(modalId)?.classList.remove('hidden');
    }

    hideModal(modalId) {
        document.getElementById(modalId)?.classList.add('hidden');
    }

    toggleElement(id, force) {
        const el = document.getElementById(id);
        if (el) {
            if (typeof force === 'boolean') {
                el.classList.toggle('hidden', !force);
            } else {
                el.classList.toggle('hidden');
            }
        }
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    manageDynamicTab(type, id, labelHint, onActivate) {
        const tabId = type === 'profile' ? 'feed-profile-tab' : 'feed-event-tab';
        const container = document.getElementById('feed-tabs-container');
        if (!container) return;

        let tab = document.getElementById(tabId);
        if (!tab) {
            tab = document.createElement('button');
            tab.id = tabId;
            tab.className = 'tab px-6 py-2 text-[0.75rem] font-bold uppercase border-b-2 border-transparent text-text-dim hover:text-accent-cyan transition-all';
            container.appendChild(tab);
        }

        tab.onclick = onActivate;

        const label = labelHint || id.substring(0, 8);
        const prefix = type === 'profile' ? '@' : 'ID:';
        tab.innerHTML = `<span class="text-accent-amber text-[0.6rem] mr-1">${prefix}</span>${label} <span class="ml-2 opacity-50 hover:opacity-100 hover:text-accent-red transition-all cursor-pointer" onclick="window.ui.closeDynamicTab(event, '${type}')">×</span>`;
        
        return tab;
    }

    closeDynamicTab(e, type) {
        if (e) e.stopPropagation();
        const tabId = type === 'profile' ? 'feed-profile-tab' : 'feed-event-tab';
        const tab = document.getElementById(tabId);
        if (tab) tab.remove();
        
        // Dispatch custom event for main.js to handle fallback
        window.dispatchEvent(new CustomEvent('tabClosed', { detail: { type } }));
    }
}

export const ui = new UIManager();
