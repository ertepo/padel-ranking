<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import Chart from 'chart.js/auto';

  type EloSeries = {
    label: string;
    color: string;
    data: Array<number | null>;
    detail?: Array<string[] | null>;
  };

  export let labels: string[] = [];
  export let series: EloSeries[] = [];

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  onMount(async () => {
    await tick();
    if (!canvas || labels.length === 0 || series.length === 0) return;

    requestAnimationFrame(() => {
      chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: series.map((item) => ({
            label: item.label,
            data: item.data,
            borderColor: item.color,
            backgroundColor: item.color,
            pointBackgroundColor: item.color,
            pointBorderColor: '#000',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
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
    });
  });

  onDestroy(() => {
    chart?.destroy();
  });
</script>

<div class="h-80 w-full md:h-96">
  <canvas class="block h-full w-full" bind:this={canvas} aria-label="Grafico andamento ELO dei giocatori del match"></canvas>
</div>
