<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  type EloSeries = {
    label: string;
    color: string;
    data: Array<number | null>;
    detail?: Array<string[] | null>;
  };

  export let labels: string[] = [];
  export let series: EloSeries[] = [];

  let canvas: HTMLCanvasElement;
  let chart: { destroy: () => void } | null = null;
  let chartError = '';

  function isNumber(value: number | null): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  $: values = series
    .flatMap((item) => item.data)
    .filter(isNumber);

  $: suggestedMin = values.length
    ? Math.floor((Math.min(...values) - 20) / 10) * 10
    : 900;

  $: suggestedMax = values.length
    ? Math.ceil((Math.max(...values) + 20) / 10) * 10
    : 1100;

  onMount(async () => {
    if (!canvas || labels.length === 0 || series.length === 0 || values.length === 0) return;

    try {
      const { default: Chart } = await import('chart.js/auto');

      chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: series.map((item) => ({
            label: item.label,
            data: item.data.map((value) => (isNumber(value) ? value : null)),
            borderColor: item.color,
            backgroundColor: item.color,
            pointBackgroundColor: item.color,
            pointBorderColor: '#000',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            borderWidth: 4,
            tension: 0.35,
            spanGaps: true,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'nearest',
            intersect: false,
          },
          plugins: {
            legend: {
              display: true,
              labels: {
                color: '#0f172a',
                boxWidth: 14,
                boxHeight: 14,
                font: {
                  family: 'Montserrat',
                  weight: '700',
                },
              },
            },
            tooltip: {
              displayColors: true,
              callbacks: {
                title: (items) => items[0]?.label || '',
                label: (tooltipItem) => {
                  const datasetIndex = tooltipItem.datasetIndex;
                  const dataIndex = tooltipItem.dataIndex;
                  const currentSeries = series[datasetIndex];
                  const elo = currentSeries?.data[dataIndex] ?? tooltipItem.parsed.y;
                  const detail = currentSeries?.detail?.[dataIndex] || [];

                  return [
                    `${currentSeries?.label || 'Giocatore'}: ${elo} ELO`,
                    ...detail,
                  ];
                },
              },
            },
          },
          scales: {
            x: {
              grid: {
                display: false,
              },
              ticks: {
                color: '#0f172a',
                maxRotation: 0,
                autoSkip: true,
                font: {
                  family: 'Montserrat',
                  weight: '700',
                },
              },
            },
            y: {
              suggestedMin,
              suggestedMax,
              grid: {
                color: '#cbd5e1',
              },
              ticks: {
                color: '#0f172a',
                font: {
                  family: 'Montserrat',
                  weight: '700',
                },
              },
            },
          },
        },
      });
      requestAnimationFrame(() => {
        chart?.resize?.();
      });
    } catch (error) {
      chartError = error instanceof Error
        ? error.message
        : 'Errore sconosciuto durante il rendering del grafico.';
    }
  });

  onDestroy(() => {
    chart?.destroy();
  });
</script>

{#if values.length === 0}
  <div class="border-2 border-dashed border-black bg-white p-4 font-black text-slate-600">
    Dati ELO non disponibili per questo match.
  </div>
{:else if chartError}
  <div class="border-2 border-black bg-white p-4 font-black text-red-600">
    Errore grafico: {chartError}
  </div>
{:else}
  <div class="h-80 w-full border-2 border-dashed border-black bg-white md:h-96">
    <canvas class="block h-full w-full" bind:this={canvas} aria-label="Grafico andamento ELO dei giocatori del match"></canvas>
  </div>
{/if}
