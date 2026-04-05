import { Relay, nip19, finalizeEvent, getPublicKey } from 'nostr-tools';

export class NostrClient {
    constructor() {
        this.relay = null;
        this.pubkey = null;
        this.secretKey = null;
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
            this.relay.close();
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
        this.pubkey = await window.nostr.getPublicKey();
        this.onLog('log_auth_success', nip19.npubEncode(this.pubkey));
        return this.pubkey;
    }

    authenticateManual(nsecOrHex) {
        this.onLog('log_auth_manual');
        let hexSk;
        if (nsecOrHex.startsWith('nsec1')) {
            const decoded = nip19.decode(nsecOrHex);
            if (decoded.type !== 'nsec') throw new Error('Invalid NSEC format.');
            hexSk = decoded.data;
        } else if (nsecOrHex.length === 64 && /^[0-9a-fA-F]+$/.test(nsecOrHex)) {
            hexSk = new Uint8Array(nsecOrHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        } else {
            throw new Error('Unrecognized format.');
        }

        this.secretKey = hexSk;
        this.pubkey = getPublicKey(this.secretKey);
        this.onLog('log_auth_success', nip19.npubEncode(this.pubkey));
        return this.pubkey;
    }

    async signEvent(eventTemplate) {
        if (this.secretKey) {
            return finalizeEvent(eventTemplate, this.secretKey);
        } else if (window.nostr) {
            return await window.nostr.signEvent(eventTemplate);
        }
        throw new Error('No identity available to sign');
    }

    async publish(event) {
        if (!this.relay) throw new Error('Not connected to any relay');
        await this.relay.publish(event);
        this.onLog('log_publish_success');
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
