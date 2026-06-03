<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Chart from 'chart.js/auto';

  type EloPoint = {
    label: string;
    elo: number;
    detail?: string;
  };

  export let points: EloPoint[] = [];

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  onMount(() => {
    if (!canvas || points.length === 0) return;

    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: points.map((point) => point.label),
        datasets: [
          {
            label: 'ELO',
            data: points.map((point) => point.elo),
            borderColor: '#000',
            backgroundColor: '#ffcc00',
            pointBackgroundColor: '#ffcc00',
            pointBorderColor: '#000',
            pointBorderWidth: 2,
            pointRadius: 8,
            pointHoverRadius: 7,
            borderWidth: 4,
            tension: 0.4,
            fill: true,
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
              title: (items) => items[0]?.label || '',
              label: (item) => {
                const point = points[item.dataIndex];
                return point?.detail
                  ? `${point.elo} ELO - ${point.detail}`
                  : `${point?.elo ?? item.parsed.y} ELO`;
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

  onDestroy(() => {
    chart?.destroy();
  });
</script>

<div class="h-72 md:h-80">
  <canvas bind:this={canvas} aria-label="Grafico andamento ELO padel"></canvas>
</div>
