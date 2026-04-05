import { nostr } from './lib/nostr';
import { ui, TRANSLATIONS } from './lib/ui';
import { marketplace } from './lib/marketplace';
import { createEventCard } from './components/EventCard';
import { Relay, nip19, finalizeEvent } from 'nostr-tools';

// State
let currentSub = null;
let feedMode = 'global'; // 'global', 'following'
let followedPubkeys = new Set(JSON.parse(localStorage.getItem('followed_pubkeys') || '[]'));

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const manualToggleBtn = document.getElementById('toggle-manual-btn');
const manualArea = document.getElementById('manual-login-area');
const nsecInput = document.getElementById('nsec-input');
const manualAuthBtn = document.getElementById('manual-auth-btn');
const relayInput = document.getElementById('relay-url');
const connectBtn = document.getElementById('connect-btn');
const postArea = document.getElementById('post-area');
const postContent = document.getElementById('post-content');
const publishBtn = document.getElementById('publish-btn');
const feedList = document.getElementById('feed-list');
const feedGlobalBtn = document.getElementById('feed-global');
const feedFollowingBtn = document.getElementById('feed-following');

// Initial Setup
ui.setLanguage(localStorage.getItem('lang') || 'es');
ui.log('log_init');

// Relay Scroller Presets
const PRESET_RELAYS = [
    'wss://nos.lol',
    'wss://relay.damus.io',
    'wss://nostr.mom',
    'wss://relay.nostr.band',
    'wss://purplepag.es'
];

function initRelayScroller() {
    const scroller = document.getElementById('relay-scroller');
    scroller.innerHTML = '';
    PRESET_RELAYS.forEach(url => {
        const name = url.split('://')[1].split('/')[0];
        const chip = document.createElement('button');
        chip.className = `relay-chip whitespace-nowrap bg-bg-base border border-border-dim text-text-secondary text-[0.65rem] px-3 py-1 cursor-pointer transition-all font-bold uppercase hover:border-accent-cyan hover:text-accent-cyan rounded ${url === relayInput.value ? 'bg-accent-cyan text-bg-base border-accent-cyan' : ''}`;
        chip.textContent = name;
        chip.onclick = () => {
            document.querySelectorAll('.relay-chip').forEach(c => c.classList.remove('active', 'bg-accent-cyan', 'text-bg-base'));
            chip.classList.add('active', 'bg-accent-cyan', 'text-bg-base');
            relayInput.value = url;
        };
        scroller.appendChild(chip);
    });
}
initRelayScroller();

// Event Handlers
connectBtn.onclick = async () => {
    const url = relayInput.value.trim();
    if (!url) return;

    connectBtn.disabled = true;
    connectBtn.textContent = TRANSLATIONS[ui.currentLang].btn_establishing;
    
    const success = await nostr.connect(url);
    if (success) {
        ui.toggleElement('connection-menu', false);
        ui.toggleElement('feed-container', true);
        startFeedSubscription();
    }
    connectBtn.disabled = false;
    connectBtn.textContent = TRANSLATIONS[ui.currentLang].btn_establish_conn;
};

nostr.setStatusHandler((status) => {
    const wsStatus = document.getElementById('ws-status');
    if (status === 'online') {
        wsStatus.className = 'status-badge status-online px-3 py-1 rounded-full border border-accent-green/20 text-accent-green bg-accent-green/5 text-[0.65rem] font-extrabold uppercase';
        wsStatus.textContent = TRANSLATIONS[ui.currentLang].status_connected + nostr.relay.url.split('://')[1];
    } else {
        wsStatus.className = 'status-badge status-offline px-3 py-1 rounded-full border border-accent-red/20 text-accent-red bg-accent-red/5 text-[0.65rem] font-extrabold uppercase';
        wsStatus.textContent = TRANSLATIONS[ui.currentLang].conn_not_connected;
    }
});

nostr.setLogHandler((key, extra, type) => ui.log(key, extra, type));

loginBtn.onclick = async () => {
    try {
        await nostr.authenticateNIP07();
        ui.toggleElement('post-area', true);
        loginBtn.classList.add('hidden');
        manualToggleBtn.classList.add('hidden');
    } catch (e) {
        ui.log('log_error', e.message, 'error');
    }
};

manualToggleBtn.onclick = () => ui.toggleElement('manual-login-area');

manualAuthBtn.onclick = () => {
    try {
        nostr.authenticateManual(nsecInput.value.trim());
        ui.toggleElement('manual-login-area', false);
        ui.toggleElement('post-area', true);
        loginBtn.classList.add('hidden');
        manualToggleBtn.classList.add('hidden');
        nsecInput.value = '';
    } catch (e) {
        ui.log('log_error', e.message, 'error');
    }
};

publishBtn.onclick = async () => {
    const content = postContent.value.trim();
    if (!content) return;

    publishBtn.disabled = true;
    publishBtn.textContent = TRANSLATIONS[ui.currentLang].btn_signing;
    
    try {
        const eventTemplate = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: content
        };
        const signed = await nostr.signEvent(eventTemplate);
        await nostr.publish(signed);
        postContent.value = '';
        ui.log('log_publish_success');
    } catch (e) {
        ui.log('log_error', e.message, 'error');
    } finally {
        publishBtn.disabled = false;
        publishBtn.textContent = TRANSLATIONS[ui.currentLang].btn_sign_broadcast;
    }
};

function startFeedSubscription() {
    if (currentSub) currentSub.close();
    feedList.innerHTML = '';

    const filter = { kinds: [1, 30402], limit: 40 };
    if (feedMode === 'following' && followedPubkeys.size > 0) {
        filter.authors = [...followedPubkeys];
    }

    currentSub = nostr.subscribe([filter], {
        onevent(event) {
            const card = createEventCard(event);
            feedList.prepend(card);
            if (feedList.childElementCount > 40) feedList.removeChild(feedList.lastChild);
        },
        oneose() {
            ui.log('log_connected', nostr.relay.url);
        }
    });
}

feedGlobalBtn.onclick = () => {
    feedMode = 'global';
    feedGlobalBtn.classList.add('active', 'border-accent-cyan', 'text-accent-cyan');
    feedFollowingBtn.classList.remove('active', 'border-accent-cyan', 'text-accent-cyan');
    startFeedSubscription();
};

feedFollowingBtn.onclick = () => {
    feedMode = 'following';
    feedFollowingBtn.classList.add('active', 'border-accent-cyan', 'text-accent-cyan');
    feedGlobalBtn.classList.remove('active', 'border-accent-cyan', 'text-accent-cyan');
    startFeedSubscription();
};

// Lang switchers
document.getElementById('lang-en').onclick = () => ui.setLanguage('en');
document.getElementById('lang-es').onclick = () => ui.setLanguage('es');
