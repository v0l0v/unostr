import { nostr } from '../lib/nostr';
import { ui } from '../lib/ui';

/**
 * Renders a Yakihonne-compatible Smart Widget (Kind 30033)
 * @param {object} event - The Nostr event (Kind 30033)
 * @returns {HTMLElement} - The rendered widget card
 */
export function createSmartWidget(event) {
    const tags = event.tags || [];
    const getTag = (k) => (tags.find(t => t[0] === k) || [])[1];
    
    const title = getTag('title') || 'Smart Widget';
    const description = getTag('description') || event.content;
    const image = getTag('image');
    
    const container = document.createElement('div');
    container.className = 'card widget-card overflow-hidden border-2 border-accent-cyan/30 bg-bg-surface/50 backdrop-blur-sm hover:border-accent-cyan/60 transition-all';
    container.dataset.id = event.id;

    let html = '';
    
    // 1. Header Image
    if (image) {
        html += `
            <div class="h-32 w-full bg-cover bg-center border-b border-border-dim" style="background-image: url('${image}')">
                <div class="w-full h-full bg-gradient-to-t from-bg-surface to-transparent p-4 flex items-end">
                    <span class="bg-accent-cyan text-bg-base text-[0.6rem] font-black px-2 py-1 rounded uppercase tracking-tighter">SMART_WIDGET</span>
                </div>
            </div>
        `;
    }

    // 2. Content Body
    html += `
        <div class="p-6">
            <h3 class="text-xl font-black text-white mb-2 uppercase tracking-tight">${title}</h3>
            <p class="text-sm text-text-secondary leading-relaxed mb-6">${description}</p>
            
            <div id="widget-inputs-${event.id}" class="flex flex-col gap-4 mb-6">
                <!-- Dynamic Inputs -->
            </div>
            
            <div id="widget-actions-${event.id}" class="grid grid-cols-2 gap-3">
                <!-- Dynamic Buttons -->
            </div>
        </div>
        
        <div class="px-6 py-2 border-t border-border-dim bg-black/10 flex justify-between items-center">
            <div class="flex items-center gap-2">
                <div class="w-4 h-4 rounded-full bg-accent-cyan/20 flex items-center justify-center">
                    <div class="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse"></div>
                </div>
                <span class="text-[0.6rem] text-text-dim font-bold uppercase tracking-widest">LIVE_WIDGET</span>
            </div>
            <span class="text-[0.6rem] text-text-dim font-mono">${event.id.substring(0, 8)}</span>
        </div>
    `;

    container.innerHTML = html;

    // 3. Render Inputs
    const inputsContainer = container.querySelector(`#widget-inputs-${event.id}`);
    const inputTags = tags.filter(t => t[0] === 'input');
    inputTags.forEach(t => {
        const [_, type, placeholder, name] = t;
        const input = document.createElement('input');
        input.type = type || 'text';
        input.placeholder = placeholder || '';
        input.name = name || 'value';
        input.className = 'w-full bg-bg-base border border-border-dim rounded p-3 text-text-primary text-sm focus:border-accent-cyan outline-none transition-all';
        inputsContainer.appendChild(input);
    });

    // 4. Render Buttons
    const actionsContainer = container.querySelector(`#widget-actions-${event.id}`);
    const buttonTags = tags.filter(t => t[0] === 'button');
    buttonTags.forEach(t => {
        const [_, type, value, label] = t;
        const btn = document.createElement('button');
        btn.className = `btn ${type === 'post' ? 'primary' : 'secondary'} text-[0.7rem] py-2 font-black uppercase tracking-wider`;
        btn.textContent = label || type;
        
        btn.onclick = () => handleWidgetAction(event, type, value, container);
        actionsContainer.appendChild(btn);
    });

    return container;
}

async function handleWidgetAction(event, type, value, container) {
    if (type === 'link') {
        window.open(value, '_blank');
    } else if (type === 'zap') {
        window.dispatchEvent(new CustomEvent('openPayment', { 
            detail: { id: event.id, title: 'Smart Zap', price: parseInt(value) || 21000, description: 'Zap to Smart Widget' } 
        }));
    } else if (type === 'post') {
        const inputs = container.querySelectorAll('input');
        const formData = {};
        inputs.forEach(i => formData[i.name] = i.value);
        
        ui.log('log_info', `Invocando Smart Action [POST] -> ${value}`);
        
        // Visual feedback
        const btn = container.querySelector('.btn.primary');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'EXECUTING...';

        try {
            const response = await fetch(value, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pubkey: nostr.userPubKey,
                    event_id: event.id,
                    data: formData
                })
            });
            
            if (response.ok) {
                const nextEvent = await response.json();
                if (nextEvent && nextEvent.kind === 30033) {
                    ui.log('log_info', 'Widget actualizado dinámicamente.');
                    const newWidget = createSmartWidget(nextEvent);
                    container.replaceWith(newWidget);
                } else {
                    ui.log('log_info', 'Acción completada con éxito.');
                }
            }
        } catch (e) {
            ui.log('log_error', 'Error en Smart Action: ' + e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}
