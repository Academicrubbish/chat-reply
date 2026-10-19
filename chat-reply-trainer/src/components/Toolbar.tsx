import { Button, Select, Dropdown } from "antd";
import {
  EditOutlined,
  PlusOutlined,
  MoreOutlined,
  BarChartOutlined,
  AimOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { Modal } from "antd";
import type {
  ChatTarget,
  AISession,
  AnalysisData,
  GenerateMode,
  TargetDiagnosis,
} from "../types";
interface ToolbarProps {
  // Person
  target: ChatTarget | null;
  onEditTarget: () => void;
  // AI
  onAIAssist: () => void;
  isGenerating: boolean;
  aiMode: GenerateMode;
  // Session
  session: AISession | null;
  sessions: AISession[];
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  // Analysis
  onTriggerAnalysis?: (mode: "advisor" | "review") => void;
  onOpenAnalysisModal?: () => void;
  onOpenReviewModal?: () => void;
  isAnalyzing?: boolean;
  analysisMode?: "advisor" | "review" | null;
  // Context
  analysis: AnalysisData | null;
  // Diagnosis
  activeDiagnosis?: TargetDiagnosis | null;
  isDiagnosing?: boolean;
  onDiagnose?: () => void;
  // Responsive
  isMobile?: boolean;
}

export default function Toolbar({
  target,
  onEditTarget,
  onAIAssist,
  isGenerating,
  aiMode,
  session,
  sessions,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onOpenAnalysisModal,
  onOpenReviewModal,
  activeDiagnosis,
  isDiagnosing,
  isAnalyzing,
}: ToolbarProps) {
  return (
    <div className="studio-toolbar" data-tour-id="session-bar">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR NEXT WORDS</span>
          <h2>
            给回应，一点灵感<span className="spark">✳</span>
          </h2>
        </div>
        <Button
          className="generate-button"
          data-tour-id="ai-assist-btn"
          type="primary"
          onClick={onAIAssist}
          loading={isGenerating || isDiagnosing}
          icon={<ArrowRightOutlined />}
        >
          {isGenerating ? "正在构思" : "生成回复"}
        </Button>
      </div>
      <div className="studio-context">
        <span className="context-dot" />
        <span>{activeDiagnosis?.stage || "从理解对方开始"}</span>
        <span className="context-divider">/</span>
        <span>{aiMode === "quick" ? "快速灵感" : "细腻表达"}</span>
      </div>
      <div className="studio-tools">
        <Button
          icon={<AimOutlined />}
          onClick={onOpenAnalysisModal}
          loading={isDiagnosing}
          disabled={isAnalyzing}
        >
          关系诊断
        </Button>
        <Button
          icon={<BarChartOutlined />}
          onClick={onOpenReviewModal}
          disabled={isAnalyzing || isDiagnosing}
        >
          对话复盘
        </Button>
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "sessions",
                label: "切换辅导窗口",
                children: sessions.length
                  ? sessions.map((s, i) => ({
                      key: s.id,
                      label: `${s.title || `窗口 ${i + 1}`} · ${s.round_count} 轮`,
                      onClick: () => onSelectSession(s.id),
                    }))
                  : [{ key: "empty", label: "暂无辅导窗口", disabled: true }],
              },
              {
                key: "edit",
                label: "编辑对象资料",
                icon: <EditOutlined />,
                onClick: onEditTarget,
              },
              {
                key: "new",
                label: "新建辅导窗口",
                icon: <PlusOutlined />,
                onClick: onCreateSession,
              },
              {
                key: "delete",
                label: "删除当前窗口",
                danger: true,
                disabled: !session,
                onClick: () =>
                  session &&
                  Modal.confirm({
                    title: "删除当前辅导窗口？",
                    content: "窗口内的 AI 记录将被删除。",
                    okText: "删除",
                    cancelText: "取消",
                    okType: "danger",
                    onOk: () => onDeleteSession(session.id),
                  }),
              },
            ],
          }}
        >
          <Button aria-label="更多辅导操作" icon={<MoreOutlined />} />
        </Dropdown>
        <Select
          className="session-select"
          aria-label="选择辅导窗口"
          value={session?.id}
          placeholder="新的辅导窗口"
          onChange={onSelectSession}
          options={sessions.map((s, i) => ({
            value: s.id,
            label: `${s.title || `窗口 ${i + 1}`} · ${s.round_count} 轮`,
          }))}
        />
      </div>
      {target?.persona && (
        <p className="profile-hint">
          <span>关于 {target.name}</span>
          {target.persona}
        </p>
      )}
    </div>
  );
}
