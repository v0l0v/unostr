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
    card.setAttribute('data-event-id', event.id);
    card.setAttribute('data-author', event.pubkey);
    
    // Header section
    const header = document.createElement('div');
    header.className = 'flex items-center gap-4 mb-3 px-4 md:px-0';
    header.innerHTML = `
        <div class="event-avatar w-10 h-10 bg-bg-surface border border-border-dim rounded overflow-hidden flex items-center justify-center shrink-0 cursor-pointer hover:border-accent-cyan transition-all">
            ${profile.picture ? `<img src="${profile.picture}" class="w-full h-full object-cover">` : '<span class="text-text-dim">👤</span>'}
        </div>
        <div class="flex flex-col">
            <span class="font-extrabold text-sm text-text-primary hover:text-accent-cyan cursor-pointer transition-all event-name">${ui.escapeHTML(displayName)}</span>
            <div class="text-[0.65rem] flex gap-2 text-text-dim font-bold uppercase tracking-widest">
                <span class="text-accent-cyan cursor-pointer hover:underline event-npub-link">${shortNpub}</span>
                <span>•</span>
                <span>${new Date(event.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>
    `;
    
    // Header Click Handlers
    const openProfile = () => window.dispatchEvent(new CustomEvent('openProfile', { detail: { pubkey: event.pubkey, npub } }));
    header.querySelector('.event-avatar').onclick = openProfile;
    header.querySelector('.event-name').onclick = openProfile;
    header.querySelector('.event-npub-link').onclick = openProfile;
    
    card.appendChild(header);

    // Content section
    const contentContainer = document.createElement('div');
    contentContainer.className = 'pl-14 pr-4';
    
    if (event.kind === 30402 || event.kind === 31923) {
        contentContainer.innerHTML = renderMarketplaceUI(event);
        // Reservation button handler
        const reserveBtn = contentContainer.querySelector('.btn-reserve-action');
        if (reserveBtn) {
            reserveBtn.onclick = () => {
                const data = marketplace.getEventData(event);
                window.dispatchEvent(new CustomEvent('openPayment', { detail: { ...data, event } }));
            };
        }
    } else {
        const escapedContent = ui.escapeHTML(event.content);
        // Basic npub auto-linking
        const linkedContent = escapedContent.replace(/(npub1[a-z0-9]+)/g, '<span class="text-accent-cyan hover:underline cursor-pointer">$1</span>');
        contentContainer.innerHTML = `<div class="event-content text-base text-text-primary whitespace-pre-wrap break-words leading-relaxed">${linkedContent}</div>`;
    }
    card.appendChild(contentContainer);

    // Footer Actions
    const footerActions = document.createElement('div');
    footerActions.className = 'pl-14 mt-4 flex items-center gap-6';
    footerActions.innerHTML = `
        <button class="flex items-center gap-1 text-[0.65rem] font-bold text-text-dim hover:text-accent-cyan transition-all uppercase tracking-widest btn-react" title="Reaccionar">
            <span>⚡</span> <span class="hidden md:inline">ZAP</span>
        </button>
        <button class="flex items-center gap-1 text-[0.65rem] font-bold text-text-dim hover:text-accent-amber transition-all uppercase tracking-widest btn-translate" title="Traducir">
            <span>🌐</span> <span class="hidden md:inline">Traducir</span>
        </button>
        <button class="flex items-center gap-1 text-[0.65rem] font-bold text-text-dim hover:text-accent-green transition-all uppercase tracking-widest btn-copy" title="Copiar ID">
            <span>📋</span> <span class="hidden md:inline">ID</span>
        </button>
        <button class="flex items-center gap-1 text-[0.65rem] font-bold text-text-dim hover:text-white transition-all uppercase tracking-widest btn-inspect" title="Ver JSON">
            <span>{ }</span> <span class="hidden md:inline">Inspect</span>
        </button>
    `;
    
    footerActions.querySelector('.btn-react').onclick = () => {
        window.dispatchEvent(new CustomEvent('reaction', { detail: { id: event.id, author: event.pubkey } }));
    };

    footerActions.querySelector('.btn-copy').onclick = () => {
        const nevent = nip19.neventEncode({ id: event.id });
        navigator.clipboard.writeText(`nostr:${nevent}`);
        ui.log('log_info', 'Link copiado al portapapeles');
    };

    footerActions.querySelector('.btn-translate').onclick = (e) => {
        const btn = e.currentTarget;
        const contentEl = contentContainer.querySelector('.event-content');
        if (!contentEl || btn.disabled) return;
        
        btn.disabled = true;
        const originalText = contentEl.innerHTML;
        contentEl.innerHTML = `<span class="text-accent-amber animate-pulse">[TRADUCIENDO...]</span>`;
        
        setTimeout(() => {
            contentEl.innerHTML = `<div class="bg-accent-amber/10 p-2 border-l-2 border-accent-amber mb-2 text-sm italic">"Resumen para humanos: Este evento trata sobre ${event.content.substring(0, 30)}..."</div>` + originalText;
            btn.innerHTML = '<span>🌐</span> <span class="hidden md:inline">Ver Original</span>';
            btn.onclick = () => {
                contentEl.innerHTML = originalText;
                btn.innerHTML = '<span>🌐</span> <span class="hidden md:inline">Traducir</span>';
                // Reset to original onclick
            };
        }, 1200);
    };

    footerActions.querySelector('.btn-inspect').onclick = () => {
        const panel = card.querySelector('.inspector-panel');
        panel.classList.toggle('hidden');
    };

    card.appendChild(footerActions);

    // Inspector Panel
    const inspector = document.createElement('div');
    inspector.className = 'inspector-panel hidden bg-black text-accent-green font-mono text-[0.65rem] p-4 mt-4 mx-4 border border-border-dim whitespace-pre-wrap break-words rounded shadow-inner';
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
        <div class="marketplace-card bg-bg-surface border-2 border-border-dim border-l-4 border-l-accent-cyan p-6 rounded-lg relative overflow-hidden font-mono shadow-xl transition-all hover:border-accent-cyan/40 ${isConfirmed ? 'border-l-accent-green' : ''}">
            <div class="flex flex-col md:flex-row justify-between items-start mb-4 gap-4">
                <div class="text-lg font-black text-accent-cyan uppercase tracking-tighter leading-none">${ui.escapeHTML(data.title)}</div>
                <div class="text-sm font-black text-accent-amber text-right shrink-0">
                    <div>${data.price.toLocaleString()} SATS</div>
                    <div class="text-[0.6rem] text-text-dim font-bold uppercase tracking-widest">≈ ${fiat} EUR</div>
                </div>
            </div>
            
            <div class="text-sm text-text-secondary mb-6 leading-relaxed bg-black/20 p-4 rounded border border-white/5">
                ${ui.escapeHTML(data.description)}
            </div>

            <div class="mb-6">
                <div class="flex justify-between text-[0.65rem] text-text-dim font-black uppercase mb-2 tracking-widest">
                    <span>${stats.count} RESERVAS</span>
                    <span class="${isConfirmed ? 'text-accent-green' : 'text-accent-amber'}">${isConfirmed ? '✓ MÍNIMO ALCANZADO' : `FALTAN ${data.min - stats.count}`}</span>
                </div>
                <div class="h-1.5 bg-bg-base border border-white/10 rounded-full overflow-hidden relative">
                    <div class="h-full bg-accent-cyan shadow-[0_0_15px_rgba(0,242,255,0.6)] transition-all duration-1000 ease-out" style="width: ${progress}%"></div>
                    <div class="absolute inset-y-0 w-1 bg-white/40 z-10" style="left: ${(data.min / data.max) * 100}%" title="Umbral Mínimo"></div>
                </div>
                <div class="flex justify-between text-[0.55rem] text-text-dim mt-1 font-bold">
                    <span>0</span>
                    <span>META: ${data.min}</span>
                    <span>MÁX: ${data.max}</span>
                </div>
            </div>

            <!-- Escrow Audit Section -->
            ${renderEscrowAudit(stats)}

            <button class="btn-reserve-action w-full bg-accent-cyan text-bg-base font-black uppercase py-4 flex items-center justify-center gap-2 hover:bg-white hover:shadow-[0_0_30px_rgba(0,242,255,0.4)] transition-all rounded text-sm tracking-widest ${stats.reserved ? 'bg-accent-green cursor-default !shadow-none' : ''}" 
                    ${stats.reserved ? 'disabled' : ''}>
                ${stats.reserved ? '✅ PLAZA RESERVADA' : '⚡ RECLAMAR MI PLAZA'}
            </button>
        </div>
    `;
}

function renderEscrowAudit(stats) {
    if (!stats.participants || stats.participants.length === 0) return '';
    
    // We only show first 8 participants to avoid clutter
    const displayList = stats.participants.slice(0, 8);
    const extra = stats.participants.length - displayList.length;

    return `
        <div class="mb-6 border-t border-white/5 pt-4">
            <div class="text-[0.6rem] font-black text-text-dim uppercase tracking-widest mb-3 flex items-center gap-2">
                <span class="w-1.5 h-1.5 bg-accent-green rounded-full animate-pulse"></span>
                Auditoría Participantes [Escrow]
            </div>
            <div class="flex flex-wrap gap-2">
                ${displayList.map(p => {
                    const profile = nostr.profiles[p] || { picture: null };
                    return `<div class="w-6 h-6 rounded bg-bg-base border border-white/10 overflow-hidden shrink-0" title="${p}">
                        ${profile.picture ? `<img src="${profile.picture}" class="w-full h-full object-cover">` : '<span class="text-[0.5rem] flex items-center justify-center h-full opacity-30">👤</span>'}
                    </div>`;
                }).join('')}
                ${extra > 0 ? `<div class="text-[0.6rem] font-bold text-text-dim flex items-center">+${extra}</div>` : ''}
            </div>
        </div>
    `;
}
