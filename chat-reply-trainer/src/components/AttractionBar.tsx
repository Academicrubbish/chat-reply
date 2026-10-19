import { HeartOutlined } from "@ant-design/icons";
export default function AttractionBar({
  attraction,
}: {
  attraction: { score: number; reason: string } | null;
  isMobile?: boolean;
}) {
  if (!attraction) return null;
  return (
    <div className="attraction-bar">
      <HeartOutlined />
      <span>心动观察</span>
      <div className="attraction-track">
        <i
          style={{ width: `${Math.max(0, Math.min(100, attraction.score))}%` }}
        />
      </div>
      <strong>
        {attraction.score}
        <small>/100</small>
      </strong>
      <p>{attraction.reason || "根据当前聊天内容估计，仅作参考"}</p>
    </div>
  );
}
