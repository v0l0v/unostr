import { nostr } from './lib/nostr';
import { ui, TRANSLATIONS } from './lib/ui';
import { marketplace } from './lib/marketplace';
import { createEventCard } from './components/EventCard';
import { createSmartWidget } from './components/SmartWidget';
import { nip19 } from 'nostr-tools';

// State
let currentSub = null;
let feedMode = 'global'; // 'global', 'following', 'profile', 'event'
let currentProfilePubkey = null;
let currentEventId = null;
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

const profileDrawer = document.getElementById('profile-drawer');
const closeProfileBtn = document.getElementById('close-profile-btn');
const logoutBtn = document.getElementById('logout-btn');

const paymentModal = document.getElementById('payment-modal');
const closePaymentBtn = document.getElementById('close-payment-modal');
const confirmPaymentBtn = document.getElementById('confirm-payment-btn');

// Initial Setup
const initialLang = localStorage.getItem('lang') || 'es';
ui.setLanguage(initialLang);
ui.log('log_init');

// Lang Toggle Handlers
document.getElementById('lang-en').onclick = () => ui.setLanguage('en');
document.getElementById('lang-es').onclick = () => ui.setLanguage('es');

// Manual Login Toggle
manualToggleBtn.onclick = () => ui.toggleElement('manual-login-area');

if (nostr.userPubKey) {
    ui.toggleElement('post-area', true);
    ui.toggleElement('organizer-area', true);
    updateIdentityUI(); // Call the new UI updater
    fetchFollows(nostr.userPubKey);
}

function updateIdentityUI() {
    const badge = document.getElementById('profile-badge');
    if (nostr.userPubKey) {
        const npub = nip19.npubEncode(nostr.userPubKey);
        badge.textContent = `[ID: ${npub.substring(0, 8)}...]`;
        badge.classList.remove('hidden');
        badge.onclick = () => {
            window.dispatchEvent(new CustomEvent('openProfile', { detail: { pubkey: nostr.userPubKey, npub } }));
        };
        loginBtn.classList.add('hidden');
        manualToggleBtn.classList.add('hidden');
    }
}

// Relay Scroller
const PRESET_RELAYS = ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://purplepag.es'];
function initRelayScroller() {
    const scroller = document.getElementById('relay-scroller');
    if (!scroller) return;
    scroller.innerHTML = '';
    PRESET_RELAYS.forEach(url => {
        const chip = document.createElement('button');
        chip.className = `relay-chip whitespace-nowrap bg-bg-base border border-border-dim text-text-secondary text-[0.65rem] px-3 py-1 cursor-pointer transition-all font-bold uppercase hover:border-accent-cyan rounded ${url === relayInput.value ? 'bg-accent-cyan text-bg-base border-accent-cyan active' : ''}`;
        chip.textContent = url.split('://')[1];
        chip.onclick = () => {
            document.querySelectorAll('.relay-chip').forEach(c => c.classList.remove('active', 'bg-accent-cyan', 'text-bg-base'));
            chip.classList.add('active', 'bg-accent-cyan', 'text-bg-base');
            relayInput.value = url;
        };
        scroller.appendChild(chip);
    });
}
initRelayScroller();

// Subscriptions
function startFeedSubscription() {
    if (currentSub) currentSub.close();
    feedList.innerHTML = '';

    let filter = { kinds: [1, 30402, 30033], limit: 40 };
    if (feedMode === 'following' && followedPubkeys.size > 0) {
        filter.authors = [...followedPubkeys];
    } else if (feedMode === 'profile' && currentProfilePubkey) {
        filter.authors = [currentProfilePubkey];
    } else if (feedMode === 'event' && currentEventId) {
        filter = { kinds: [1, 30402, 30033], ids: [currentEventId], limit: 1 };
    }

    currentSub = nostr.subscribe([filter], {
        onevent(event) {
            let card;
            if (event.kind === 30033) {
                card = createSmartWidget(event);
            } else {
                card = createEventCard(event);
            }
            feedList.prepend(card);
            if (feedList.childElementCount > 40) feedList.removeChild(feedList.lastChild);
        },
        oneose() {
            ui.log('log_connected', nostr.relay.url);
        }
    });
}

// Handlers
connectBtn.onclick = async () => {
    const url = relayInput.value.trim();
    if (!url) return;
    connectBtn.disabled = true;
    const success = await nostr.connect(url);
    if (success) {
        ui.toggleElement('connection-menu', false);
        ui.toggleElement('feed-container', true);
        startFeedSubscription();
    }
    connectBtn.disabled = false;
};
nostr.setStatusHandler((status) => {
    const wsStatus = document.getElementById('ws-status');
    if (status === 'online') {
        wsStatus.className = 'status-badge status-online px-3 py-1 rounded-full border border-accent-green/20 text-accent-green bg-accent-green/5 text-[0.65rem] font-extrabold uppercase cursor-default';
        wsStatus.textContent = TRANSLATIONS[ui.currentLang].status_connected + (nostr.relay ? nostr.relay.url.split('://')[1] : '...');
    } else {
        wsStatus.className = 'status-badge status-offline px-3 py-1 rounded-full border border-accent-red/20 text-accent-red bg-accent-red/5 text-[0.65rem] font-extrabold uppercase cursor-pointer hover:bg-accent-red/10 transition-all';
        wsStatus.textContent = TRANSLATIONS[ui.currentLang].conn_not_connected + ' [RECONNECT]';
    }
    wsStatus.onclick = () => {
        if (status === 'offline') connectBtn.click();
    };
});

nostr.setLogHandler((key, extra, type) => ui.log(key, extra, type));

loginBtn.onclick = async () => {
    await nostr.authenticateNIP07();
    ui.toggleElement('post-area', true);
    ui.toggleElement('organizer-area', true);
    updateIdentityUI(); // Show user ID in header
    if (nostr.userPubKey) fetchFollows(nostr.userPubKey);
};

manualAuthBtn.onclick = () => {
    nostr.authenticateManual(nsecInput.value.trim());
    ui.toggleElement('manual-login-area', false);
    ui.toggleElement('post-area', true);
    ui.toggleElement('organizer-area', true);
    updateIdentityUI(); // Show user ID in header
    if (nostr.userPubKey) fetchFollows(nostr.userPubKey);
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

logoutBtn.onclick = () => {
    localStorage.removeItem('userPubKey');
    localStorage.removeItem('followed_pubkeys');
    location.reload();
};

async function fetchFollows(pubkey) {
    ui.log('log_info', 'Synchronizing contacts list (Kind 3)...');
    const sub = nostr.subscribe([{ kinds: [3], authors: [pubkey], limit: 1 }], {
        onevent(event) {
            const remote = event.tags.filter(t => t[0] === 'p').map(t => t[1]);
            remote.forEach(p => followedPubkeys.add(p));
            localStorage.setItem('followed_pubkeys', JSON.stringify([...followedPubkeys]));
            sub.close();
        }
    });
}

window.addEventListener('langChanged', () => {
    // Force refresh status badge translation
    if (nostr.relay) {
        nostr.onStatusChange('online');
    } else {
        nostr.onStatusChange('offline');
    }
});

// UI Custom Events
window.addEventListener('openProfile', (e) => {
    const { pubkey, npub } = e.detail;
    currentProfilePubkey = pubkey;
    
    // UI Profile Drawer
    ui.log('log_profile_init', npub);
    const profile = nostr.profiles[pubkey] || {};
    populateProfileDrawer(pubkey, profile);
    profileDrawer.classList.remove('hidden');
    
    // Feed logic
    feedMode = 'profile';
    ui.manageDynamicTab('profile', pubkey, profile.name || npub.substring(0, 8), () => {
        feedMode = 'profile';
        currentProfilePubkey = pubkey;
        updateFeedUI();
        startFeedSubscription();
    });
    
    updateFeedUI();
    startFeedSubscription();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

function populateProfileDrawer(pubkey, profile) {
    document.getElementById('profile-name-full').textContent = profile.name || pubkey.substring(0, 8);
    document.getElementById('profile-nip05').textContent = profile.nip05 || '';
    document.getElementById('profile-about').textContent = profile.about || '';
    document.getElementById('profile-website').innerHTML = profile.website ? `<a href="${profile.website}" target="_blank" class="text-accent-cyan hover:underline">${profile.website}</a>` : '';
    document.getElementById('profile-banner').style.backgroundImage = profile.banner ? `url(${profile.banner})` : 'none';
    document.getElementById('profile-picture').innerHTML = profile.picture ? `<img src="${profile.picture}" class="w-full h-full object-cover">` : '👤';
    
    const followBtn = document.getElementById('follow-drawer-btn');
    const isFollowing = followedPubkeys.has(pubkey);
    followBtn.textContent = isFollowing ? TRANSLATIONS[ui.currentLang].btn_unfollow : TRANSLATIONS[ui.currentLang].btn_follow;
    followBtn.className = isFollowing ? 'btn border-accent-red text-accent-red text-[0.7rem] px-4 flex-1' : 'btn primary text-[0.7rem] px-4 flex-1';
    
    followBtn.onclick = () => {
        window.dispatchEvent(new CustomEvent('toggleFollow', { detail: { pubkey } }));
        populateProfileDrawer(pubkey, profile); // Refresh drawer UI
    };

    // Hide logout if not me
    document.getElementById('logout-btn').classList.toggle('hidden', pubkey !== nostr.userPubKey);
}

window.addEventListener('tabClosed', (e) => {
    if (feedMode === e.detail.type) {
        feedMode = 'global';
        updateFeedUI();
        startFeedSubscription();
    }
});

function updateFeedUI() {
    feedGlobalBtn.classList.toggle('active', feedMode === 'global');
    feedFollowingBtn.classList.toggle('active', feedMode === 'following');
    const pTab = document.getElementById('feed-profile-tab');
    if (pTab) pTab.classList.toggle('active', feedMode === 'profile');
}

// Marketplace Flow
let activeReservation = null;
window.addEventListener('openPayment', (e) => {
    activeReservation = e.detail;
    document.getElementById('modal-event-title').textContent = activeReservation.title;
    document.getElementById('modal-event-desc').textContent = activeReservation.description;
    document.getElementById('modal-event-price').textContent = activeReservation.price.toLocaleString();
    document.getElementById('modal-event-fiat').textContent = `≈ ${marketplace.formatFiat(activeReservation.price)} EUR`;
    document.getElementById('qr-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=lightning:event-${activeReservation.id}`;
    paymentModal.classList.remove('hidden');
});

confirmPaymentBtn.onclick = async () => {
    if (!activeReservation) return;
    confirmPaymentBtn.disabled = true;
    document.getElementById('payment-status-text').classList.remove('hidden');
    
    // Simulate payment
    await new Promise(r => setTimeout(r, 2000));
    
    marketplace.reservePlacement(activeReservation.id, nostr.userPubKey || 'anon');
    ui.log('log_publish_success', ' Plaza reservada en memoria local.');
    paymentModal.classList.add('hidden');
    confirmPaymentBtn.disabled = false;
    document.getElementById('payment-status-text').classList.add('hidden');
    
    // Refresh feed
    startFeedSubscription();
};

window.addEventListener('reaction', async (e) => {
    if (!nostr.relay) return ui.log('log_error', 'Not connected to relay', 'warn');
    const { id, author } = e.detail;
    
    ui.log('log_react_start');
    const event = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        content: '+',
        tags: [
            ['e', id],
            ['p', author]
        ]
    };

    try {
        const signed = await nostr.signEvent(event);
        await nostr.publish(signed);
        ui.log('log_react_ok');
    } catch (err) {
        ui.log('log_error', 'Reacción fallida: ' + err.message, 'warn');
    }
});

// Follow/Unfollow Toggle
window.addEventListener('toggleFollow', async (e) => {
    const { pubkey } = e.detail;
    if (followedPubkeys.has(pubkey)) {
        followedPubkeys.delete(pubkey);
        ui.log('log_unfollow_ok');
    } else {
        followedPubkeys.add(pubkey);
        ui.log('log_follow_ok');
    }
    localStorage.setItem('followed_pubkeys', JSON.stringify([...followedPubkeys]));
    
    if (nostr.userPubKey) {
        ui.log('log_info', 'Uploading contact list update...');
        const tags = [...followedPubkeys].map(p => ['p', p]);
        const event = { kind: 3, created_at: Math.floor(Date.now() / 1000), tags, content: '' };
        try {
            const signed = await nostr.signEvent(event);
            await nostr.publish(signed);
        } catch (e) {
            ui.log('log_error', 'Sync failed: ' + e.message, 'warn');
        }
    }
});

// Organizer Mode Editing
const organizerModeBtn = document.getElementById('organizer-mode-btn');
const eventCreatorArea = document.getElementById('event-creator-area');
let organizerMode = false;

window.toggleOrganizerMode = (force) => {
    organizerMode = typeof force === 'boolean' ? force : !organizerMode;
    organizerModeBtn.classList.toggle('active', organizerMode);
    organizerModeBtn.textContent = organizerMode ? '⚙️ MODO_ORGANIZADOR [ON]' : '⚙️ MODO_ORGANIZADOR [OFF]';
    eventCreatorArea.classList.toggle('hidden', !organizerMode);
};

organizerModeBtn.onclick = () => window.toggleOrganizerMode();

document.getElementById('publish-event-btn').onclick = async () => {
    const title = document.getElementById('event-title-input').value;
    const desc = document.getElementById('event-desc-input').value;
    const price = parseInt(document.getElementById('event-price-input').value);
    const min = parseInt(document.getElementById('event-min-input').value);
    const max = parseInt(document.getElementById('event-max-input').value);
    
    if (!title || !price || !min) return ui.log('log_error', 'Faltan campos obligatorios', 'warn');
    
    const eventId = 'ev-' + Math.random().toString(36).substring(2, 7);
    const eventTemplate = {
        kind: 30402,
        created_at: Math.floor(Date.now() / 1000),
        content: desc,
        tags: [
            ['d', eventId],
            ['title', title],
            ['summary', title],
            ['description', desc],
            ['price', price.toString(), 'sats'],
            ['min', min.toString()],
            ['max', max.toString()],
            ['t', 'event-marketplace']
        ]
    };

    try {
        const signed = await nostr.signEvent(eventTemplate);
        await nostr.publish(signed);
        ui.log('log_info', `¡Evento "${title}" publicado!`, 'success');
        window.toggleOrganizerMode(false);
        startFeedSubscription();
    } catch (err) {
        ui.log('log_error', 'Error al publicar: ' + err.message, 'error');
    }
};

closePaymentBtn.onclick = () => paymentModal.classList.add('hidden');
closeProfileBtn.onclick = () => profileDrawer.classList.add('hidden');

feedGlobalBtn.onclick = () => { feedMode = 'global'; updateFeedUI(); startFeedSubscription(); };
feedFollowingBtn.onclick = () => { feedMode = 'following'; updateFeedUI(); startFeedSubscription(); };
