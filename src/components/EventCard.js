import { nip19 } from 'nostr-tools';
import { nostr } from '../lib/nostr';
import { marketplace } from '../lib/marketplace';
import { ui } from '../lib/ui';

export function createEventCard(event, options = {}) {
    const npub = nip19.npubEncode(event.pubkey);
    const shortNpub = `${npub.substring(0, 8)}...${npub.substring(npub.length - 4)}`;
    
    const profile = nostr.profiles[event.pubkey] || { name: null, picture: null };
    const displayName = profile.name || shortNpub;
    
    const card = document.createElement('div');
    card.className = 'event-card border-t border-border-dim py-6 relative hover:bg-accent-cyan/5 transition-all';
    card.setAttribute('data-author', event.pubkey);
    
    // Header section
    const header = document.createElement('div');
    header.className = 'flex items-center gap-4 mb-3';
    header.innerHTML = `
        <div class="event-avatar w-10 h-10 bg-bg-surface border border-border-dim rounded overflow-hidden flex items-center justify-center shrink-0">
            ${profile.picture ? `<img src="${profile.picture}" class="w-full h-full object-cover">` : '<span class="text-text-dim">👤</span>'}
        </div>
        <div class="flex flex-col">
            <span class="font-extrabold text-sm text-text-primary">${ui.escapeHTML(displayName)}</span>
            <div class="text-[0.7rem] flex gap-2 text-text-dim">
                <span class="text-accent-cyan cursor-pointer hover:underline" onclick="viewProfile('${npub}')">${shortNpub}</span>
                <span>${new Date(event.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>
    `;
    card.appendChild(header);

    // Content section (Discerning between Kind 1 and Kind 30402)
    const contentContainer = document.createElement('div');
    contentContainer.className = 'pl-12';
    
    if (event.kind === 30402 || event.kind === 31923) {
        contentContainer.innerHTML = renderMarketplaceUI(event);
    } else {
        contentContainer.innerHTML = `<div class="event-content text-base text-text-primary whitespace-pre-wrap break-words">${ui.escapeHTML(event.content)}</div>`;
    }
    card.appendChild(contentContainer);

    // Actions section
    const actions = document.createElement('div');
    actions.className = 'absolute top-6 right-0 flex gap-2';
    actions.innerHTML = `
        <button class="btn-react text-[0.65rem] border border-accent-cyan/20 bg-accent-cyan/5 px-2 py-1 text-accent-cyan rounded hover:bg-accent-cyan hover:text-bg-base transition-all" title="Reaccionar">⚡</button>
        <button class="btn-inspect bg-transparent border border-border-dim text-text-dim text-[0.65rem] px-2 py-1 hover:text-accent-amber hover:border-accent-amber transition-all" title="Ver JSON">[JSON]</button>
    `;
    
    actions.querySelector('.btn-inspect').onclick = () => {
        const panel = card.querySelector('.inspector-panel');
        panel.classList.toggle('hidden');
    };
    
    card.appendChild(actions);

    // Inspector Panel
    const inspector = document.createElement('div');
    inspector.className = 'inspector-panel hidden bg-black text-accent-green font-mono text-[0.7rem] p-4 mt-4 border border-border-dim whitespace-pre-wrap break-words';
    inspector.textContent = JSON.stringify(event, null, 4);
    card.appendChild(inspector);

    // Fetch profile if missing
    if (!profile.name) {
        nostr.fetchProfile(event.pubkey, (newProfile) => {
            const nameEl = card.querySelector('.event-name');
            if (nameEl) nameEl.textContent = newProfile.name || shortNpub;
            const avatarEl = card.querySelector('.event-avatar');
            if (avatarEl && newProfile.picture) {
                avatarEl.innerHTML = `<img src="${newProfile.picture}" class="w-full h-full object-cover">`;
            }
        });
    }

    return card;
}

function renderMarketplaceUI(event) {
    const data = marketplace.getEventData(event);
    const stats = marketplace.getStats(data.id);
    const progress = marketplace.calculateProgress(stats, data.max);
    const isConfirmed = stats.count >= data.min;
    const fiat = marketplace.formatFiat(data.price);

    return `
        <div class="marketplace-card bg-accent-cyan/5 border-2 border-border-dim border-l-4 border-l-accent-cyan p-6 rounded relative overflow-hidden font-mono ${isConfirmed ? 'border-l-accent-green bg-accent-green/5' : ''}">
            <div class="flex justify-between items-start mb-4">
                <div class="text-lg font-extrabold text-accent-cyan uppercase">${ui.escapeHTML(data.title)}</div>
                <div class="text-sm font-extrabold text-accent-amber text-right">
                    ${data.price.toLocaleString()} SATS
                    <span class="block text-[0.65rem] text-text-dim font-normal">≈ ${fiat} €</span>
                </div>
            </div>
            
            <div class="text-sm text-text-primary mb-4 leading-relaxed">
                ${ui.escapeHTML(data.description)}
            </div>

            <div class="my-6">
                <div class="h-2 bg-bg-base border border-border-dim rounded mb-2 relative">
                    <div class="h-full bg-accent-cyan shadow-[0_0_10px_var(--color-accent-cyan)] transition-all duration-1000" style="width: ${progress}%"></div>
                    <div class="absolute -top-1 -bottom-1 w-[2px] bg-accent-amber z-10" style="left: ${(data.min / data.max) * 100}%" title="Mínimo: ${data.min}"></div>
                </div>
                <div class="flex justify-between text-[0.7rem] text-text-secondary font-bold">
                    <span>${stats.count} RESERVAS</span>
                    <span>META: ${data.min} (MÁX: ${data.max})</span>
                </div>
            </div>

            <button class="w-full bg-accent-cyan text-bg-base font-extrabold uppercase py-3 flex items-center justify-center gap-2 hover:bg-white hover:shadow-[0_0_20px_rgba(0,242,255,0.4)] transition-all ${stats.reserved ? 'bg-accent-green cursor-default' : ''}" 
                    ${stats.reserved ? 'disabled' : ''}>
                ${stats.reserved ? '✅ PLAZA RESERVADA' : '▶️ PRE-RESERVAR PLAZA'}
            </button>

            ${isConfirmed ? '<div class="mt-4 text-center border border-accent-green text-accent-green text-[0.7rem] font-bold p-2 rounded uppercase">✓ Evento Confirmado (Mínimo alcanzado)</div>' : ''}
        </div>
    `;
}
