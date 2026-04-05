import { Relay, nip19, finalizeEvent, getPublicKey } from 'nostr-tools';

export class NostrClient {
    constructor() {
        this.relay = null;
        this.userPubKey = localStorage.getItem('userPubKey');
        this.userSecretKey = null; // Memory only
        this.profiles = {};
        this.onLog = (msg, extra, type) => console.log(msg, extra, type);
        this.onStatusChange = (status) => {};
    }

    setLogHandler(handler) {
        this.onLog = handler;
    }

    setStatusHandler(handler) {
        this.onStatusChange = handler;
    }

    async connect(url) {
        if (this.relay) {
            try { this.relay.close(); } catch(e) {}
        }

        this.onLog('log_connecting', url);
        try {
            this.relay = await Relay.connect(url);
            this.onLog('log_connected', url);
            this.onStatusChange('online');
            return true;
        } catch (error) {
            this.onLog('log_error', error.message, 'error');
            this.onStatusChange('offline');
            return false;
        }
    }

    async authenticateNIP07() {
        if (!window.nostr) {
            throw new Error('Nostr extension not found');
        }
        this.onLog('log_auth_start');
        const pk = await window.nostr.getPublicKey();
        this.userPubKey = pk;
        localStorage.setItem('userPubKey', pk);
        this.onLog('log_auth_success', nip19.npubEncode(this.userPubKey));
        return this.userPubKey;
    }

    authenticateManual(nsecOrHex) {
        this.onLog('log_auth_manual');
        let hexSk;
        try {
            if (nsecOrHex.startsWith('nsec1')) {
                const decoded = nip19.decode(nsecOrHex);
                if (decoded.type !== 'nsec') throw new Error('Invalid NSEC');
                hexSk = decoded.data;
            } else if (nsecOrHex.length === 64 && /^[0-9a-fA-F]+$/.test(nsecOrHex)) {
                hexSk = new Uint8Array(nsecOrHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            } else {
                throw new Error('Formato no reconocido. Usa nsec1... o 64 caracteres hex.');
            }

            this.userSecretKey = hexSk;
            this.userPubKey = getPublicKey(this.userSecretKey);
            localStorage.setItem('userPubKey', this.userPubKey);
            this.onLog('log_auth_success', nip19.npubEncode(this.userPubKey));
            return this.userPubKey;
        } catch (e) {
            this.onLog('log_error', e.message, 'error');
            throw e;
        }
    }

    async signEvent(eventTemplate) {
        if (this.userSecretKey) {
            return finalizeEvent(eventTemplate, this.userSecretKey);
        } else if (window.nostr) {
            return await window.nostr.signEvent(eventTemplate);
        }
        throw new Error('No hay identidad cargada para firmar (Inicie sesión)');
    }

    async publish(event) {
        if (!this.relay) throw new Error('No conectado al relay');
        try {
            await this.relay.publish(event);
            this.onLog('log_publish_success');
        } catch (e) {
            this.onLog('log_error', 'Fallo al publicar: ' + e.message, 'error');
            throw e;
        }
    }

    subscribe(filters, callbacks) {
        if (!this.relay) return null;
        return this.relay.subscribe(filters, callbacks);
    }

    async fetchProfile(pubkey, callback) {
        if (this.profiles[pubkey] && this.profiles[pubkey].loading !== false) return;
        
        this.profiles[pubkey] = { loading: true };
        
        const sub = this.subscribe([
            { kinds: [0], authors: [pubkey], limit: 1 }
        ], {
            onevent: (event) => {
                try {
                    const data = JSON.parse(event.content);
                    this.profiles[pubkey] = {
                        ...data,
                        loading: false
                    };
                    if (callback) callback(this.profiles[pubkey]);
                } catch (e) {
                    this.profiles[pubkey].loading = false;
                }
                sub.close();
            },
            oneose: () => sub.close()
        });
    }
}

export const nostr = new NostrClient();
