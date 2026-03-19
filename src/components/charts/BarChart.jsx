import { DS } from "../../design/tokens";

export const BarChart = ({ data, height = 200, showLabels = true }) => {
  if (!data || data.length === 0) return null;
  const maxValue = Math.max(...data.map(d => d.value));
  const barHeight = Math.min(24, (height - 20) / data.length - 4);

  return (
    <svg width="100%" height={height} style={{ overflow: "visible" }}>
      {data.map((item, i) => {
        const barWidth = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        const y = i * (barHeight + 8) + 10;
        return (
          <g key={i}>
            {showLabels && (
              <text x="0" y={y + barHeight / 2 + 4} fontSize="11" fill={DS.colors.textMuted}>
                {item.label.length > 15 ? item.label.slice(0, 15) + "..." : item.label}
              </text>
            )}
            <rect
              x={showLabels ? "40%" : "0"}
              y={y}
              width={`${barWidth * (showLabels ? 0.5 : 0.9)}%`}
              height={barHeight}
              rx="3"
              fill={item.color || DS.colors.shock}
              style={{ transition: "width 0.5s ease" }}
            />
            <text
              x={showLabels ? `${42 + barWidth * 0.5}%` : `${barWidth * 0.9 + 2}%`}
              y={y + barHeight / 2 + 4}
              fontSize="11"
              fill={DS.colors.text}
              fontFamily={DS.fonts.mono}
            >
              ${item.value.toLocaleString()}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
