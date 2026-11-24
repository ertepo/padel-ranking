<script lang="ts">
  // Finestra modale nello stile del club: sfondo scuro, club-card bianca,
  // titolo, corpo scorrevole e riga di azioni in fondo. Si chiude con Esc o
  // cliccando sullo sfondo (se onClose è dato). Il genitore decide quando
  // mostrarla: {#if aperto}<Modal ...>{/if}.
  import type { Snippet } from 'svelte';

  interface Props {
    titolo: string;
    onClose?: () => void;
    /** Classe Tailwind della larghezza massima, es. 'max-w-sm', 'max-w-lg'. */
    larghezza?: string;
    /** Margini ridotti e più altezza: per schermi bassi (tablet in orizzontale). */
    compatta?: boolean;
    children: Snippet;
    azioni?: Snippet;
  }

  let { titolo, onClose, larghezza = 'max-w-sm', compatta = false, children, azioni }: Props = $props();

  const titoloId = `modal-titolo-${Math.random().toString(36).slice(2, 9)}`;
  let cardEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    // Il focus entra nella modale, così Tab e i lettori di schermo partono da qui.
    const primo = cardEl?.querySelector<HTMLElement>('input, select, textarea, button');
    primo?.focus();
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && onClose) {
      e.preventDefault();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class={`fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 ${compatta ? 'p-2' : 'p-4'}`}
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose?.();
  }}
>
  <div
    bind:this={cardEl}
    class={`club-card flex w-full ${larghezza} flex-col bg-white ${compatta ? 'px-5 py-3' : 'p-5'}`}
    style={`max-height: ${compatta ? 96 : 88}vh;`}
    role="dialog"
    aria-modal="true"
    aria-labelledby={titoloId}
  >
    <h3 id={titoloId} class={`${compatta ? 'mb-2' : 'mb-4'} text-xl font-black`}>{titolo}</h3>

    <div class="min-h-0 space-y-3 overflow-y-auto pr-1">
      {@render children()}
    </div>

    {#if azioni}
      <div class={`${compatta ? 'mt-3' : 'mt-5'} flex gap-3`}>
        {@render azioni()}
      </div>
    {/if}
  </div>
</div>
