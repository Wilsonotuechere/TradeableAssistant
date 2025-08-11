import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

interface PriceChartProps {
  data?: number[];
  labels?: string[];
  title?: string;
}

export default function PriceChart({ 
  data = [42100, 42800, 43200, 43500, 43247, 43800, 43247],
  labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
  title = "Bitcoin Price Chart"
}: PriceChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Destroy existing chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: title,
          data,
          borderColor: '#1F8EF1',
          backgroundColor: 'rgba(31, 142, 241, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#1F8EF1',
          pointBorderColor: '#1F8EF1',
          pointHoverBackgroundColor: '#9B5DE5',
          pointHoverBorderColor: '#9B5DE5',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(31, 142, 241, 0.1)'
            },
            ticks: {
              color: '#9AA0A6'
            }
          },
          y: {
            grid: {
              color: 'rgba(31, 142, 241, 0.1)'
            },
            ticks: {
              color: '#9AA0A6',
              callback: function(value) {
                return '$' + Number(value).toLocaleString();
              }
            }
          }
        },
        elements: {
          point: {
            radius: 4,
            hoverRadius: 8
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, labels, title]);

  return (
    <div className="h-64 relative">
      <canvas ref={chartRef} />
    </div>
  );
}
