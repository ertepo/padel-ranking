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
    /** Altezza fissa (non segue il contenuto): cambiando scheda pulsanti e campi non si spostano. */
    altezzaFissa?: boolean;
    children: Snippet;
    azioni?: Snippet;
  }

  let { titolo, onClose, larghezza = 'max-w-sm', compatta = false, altezzaFissa = false, children, azioni }: Props = $props();

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
    style={altezzaFissa
      ? `height: ${compatta ? '96vh' : 'min(88vh, 46rem)'};`
      : `max-height: ${compatta ? 96 : 88}vh;`}
    role="dialog"
    aria-modal="true"
    aria-labelledby={titoloId}
  >
    <h3 id={titoloId} class={`${compatta ? 'mb-3' : 'mb-4'} text-xl font-black leading-tight`}>{titolo}</h3>

    <!-- Un po' di margine dentro l'area che scorre: bordi, contorni di selezione
         e ombre dei campi non vengono tagliati né toccano la barra di scorrimento. -->
    <div class="modal-corpo -mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1 pb-1 pr-2 pt-0.5" class:flex-1={altezzaFissa}>
      {@render children()}
    </div>

    {#if azioni}
      <div class={`${compatta ? 'mt-3' : 'mt-4'} flex gap-3 border-t-2 border-black pt-3`}>
        {@render azioni()}
      </div>
    {/if}
  </div>
</div>

<style>
  /* I campi non escono mai dalla loro colonna (su Android data e ora hanno
     una larghezza minima propria e finirebbero sopra il campo accanto). */
  /* Spazi con gap e non con space-y: in sviluppo Tailwind scrive space-y con
     il CSS annidato, che Chrome capisce solo dalla 112 (il tablet ha la 106). */
  .modal-corpo > :global(*) {
    flex-shrink: 0;
  }

  .modal-corpo :global(input),
  .modal-corpo :global(select),
  .modal-corpo :global(textarea) {
    min-width: 0;
    max-width: 100%;
  }
</style>
