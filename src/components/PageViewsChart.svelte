<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Chart from 'chart.js/auto';

  type DayPoint = {
    label: string;
    views: number;
  };

  export let points: DayPoint[] = [];

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  onMount(() => {
    if (!canvas || points.length === 0) return;

    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: points.map((point) => point.label),
        datasets: [
          {
            label: 'Visite',
            data: points.map((point) => point.views),
            backgroundColor: '#ffcc00',
            borderColor: '#000',
            borderWidth: 2,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            displayColors: false,
            callbacks: {
              label: (item) => `${item.parsed.y} visite`,
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
              font: {
                family: 'Montserrat',
                weight: '700',
              },
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: '#cbd5e1',
            },
            ticks: {
              color: '#0f172a',
              precision: 0,
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

  onDestroy(() => {
    chart?.destroy();
  });
</script>

<div class="h-72 md:h-80">
  <canvas bind:this={canvas} aria-label="Grafico andamento visite giornaliere"></canvas>
</div>
